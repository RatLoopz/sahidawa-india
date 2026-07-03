import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../app";
import { supabase } from "../db/client";
import { v4 as uuidv4 } from "uuid";

describe("Product Reviews Duplicate Prevention (Issue #3047)", () => {
    let buyerId: string;
    let sellerId: string;
    let productId: string;
    let buyerToken: string;

    const generateMockToken = (userId: string): string => {
        return Buffer.from(
            JSON.stringify({ sub: userId, iat: Math.floor(Date.now() / 1000) })
        ).toString("base64");
    };

    beforeAll(async () => {
        buyerId = uuidv4();
        sellerId = uuidv4();
        productId = uuidv4();
        buyerToken = generateMockToken(buyerId);

        // Create sellers entries
        await supabase.from("sellers").upsert([
            {
                id: sellerId,
                shop_name: "Test Seller",
                is_verified: true,
            },
            {
                id: buyerId,
                shop_name: "Test Buyer",
                is_verified: false,
            },
        ]);

        // Create product
        await supabase.from("products").insert([
            {
                id: productId,
                seller_id: sellerId,
                title: "Test Product for Reviews",
                description: "Test product",
                price: 99.99,
                category: "test",
                stock: 10,
                is_active: true,
            },
        ]);

        // Create completed order for buyer
        await supabase.from("orders").insert([
            {
                buyer_id: buyerId,
                product_id: productId,
                seller_id: sellerId,
                quantity: 1,
                price_per_unit: 99.99,
                total_price: 99.99,
                status: "completed",
            },
        ]);
    });

    afterAll(async () => {
        await supabase.from("reviews").delete().eq("product_id", productId);
        await supabase.from("orders").delete().eq("product_id", productId);
        await supabase.from("products").delete().eq("id", productId);
        await supabase.from("sellers").delete().in("id", [buyerId, sellerId]);
    });

    // ============================================================================
    // Test 1: User can create a review for purchased product
    // ============================================================================
    it("authenticated user can create review for purchased product", async () => {
        const res = await request(app)
            .post("/api/reviews")
            .set("Authorization", `Bearer ${buyerToken}`)
            .send({
                product_id: productId,
                rating: 5,
                title: "Excellent product",
                comment: "Very satisfied with this purchase",
            })
            .expect(201);

        expect(res.body.id).toBeDefined();
        expect(res.body.rating).toBe(5);
        expect(res.body.title).toBe("Excellent product");
        expect(res.body.buyer_id).toBe(buyerId);
        expect(res.body.is_verified_purchase).toBe(true);
    });

    // ============================================================================
    // Test 2: User cannot create duplicate review (409 Conflict)
    // ============================================================================
    it("user cannot create duplicate review for same product", async () => {
        const res = await request(app)
            .post("/api/reviews")
            .set("Authorization", `Bearer ${buyerToken}`)
            .send({
                product_id: productId,
                rating: 4,
                title: "Different review",
                comment: "This should fail",
            })
            .expect(409);

        expect(res.body.error).toBe("Conflict");
        expect(res.body.message).toContain("already reviewed");
    });

    // ============================================================================
    // Test 3: User cannot review without purchase
    // ============================================================================
    it("user cannot review product without purchase", async () => {
        const nonBuyerId = uuidv4();
        const nonBuyerToken = generateMockToken(nonBuyerId);

        await supabase.from("sellers").insert([
            {
                id: nonBuyerId,
                shop_name: "Non-buyer",
                is_verified: false,
            },
        ]);

        const res = await request(app)
            .post("/api/reviews")
            .set("Authorization", `Bearer ${nonBuyerToken}`)
            .send({
                product_id: productId,
                rating: 3,
                comment: "Should fail - no purchase",
            })
            .expect(403);

        expect(res.body.error).toBe("Forbidden");
        expect(res.body.message).toContain("only review products you have purchased");

        // Cleanup
        await supabase.from("sellers").delete().eq("id", nonBuyerId);
    });

    // ============================================================================
    // Test 4: User can update their existing review
    // ============================================================================
    it("user can update their own review", async () => {
        // Get the review ID
        const { data: reviews } = await supabase
            .from("reviews")
            .select("id")
            .eq("buyer_id", buyerId)
            .eq("product_id", productId)
            .limit(1)
            .single();

        if (!reviews) {
            throw new Error("Review not found");
        }

        const reviewId = reviews.id;

        const res = await request(app)
            .patch(`/api/reviews/${reviewId}`)
            .set("Authorization", `Bearer ${buyerToken}`)
            .send({
                rating: 4,
                title: "Updated title",
                comment: "Updated comment after more thought",
            })
            .expect(200);

        expect(res.body.rating).toBe(4);
        expect(res.body.title).toBe("Updated title");
        expect(res.body.comment).toBe("Updated comment after more thought");
    });

    // ============================================================================
    // Test 5: Unique constraint enforced at database level
    // ============================================================================
    it("database enforces unique constraint on product_id + buyer_id", async () => {
        // Try to insert duplicate directly via database
        const { error } = await supabase.from("reviews").insert([
            {
                product_id: productId,
                buyer_id: buyerId,
                seller_id: sellerId,
                rating: 2,
                title: "Duplicate via DB",
                comment: "This violates unique constraint",
                is_verified_purchase: true,
            },
        ]);

        expect(error).toBeDefined();
        expect(error?.code).toBe("23505"); // PostgreSQL unique constraint violation
    });

    // ============================================================================
    // Test 6: Multiple users can review same product
    // ============================================================================
    it("different users can create reviews for same product", async () => {
        const buyer2Id = uuidv4();
        const buyer2Token = generateMockToken(buyer2Id);

        await supabase.from("sellers").insert([
            {
                id: buyer2Id,
                shop_name: "Second Buyer",
                is_verified: false,
            },
        ]);

        // Create order for second buyer
        await supabase.from("orders").insert([
            {
                buyer_id: buyer2Id,
                product_id: productId,
                seller_id: sellerId,
                quantity: 1,
                price_per_unit: 99.99,
                total_price: 99.99,
                status: "completed",
            },
        ]);

        // Second buyer creates review
        const res = await request(app)
            .post("/api/reviews")
            .set("Authorization", `Bearer ${buyer2Token}`)
            .send({
                product_id: productId,
                rating: 3,
                title: "Good product",
                comment: "Average experience",
            })
            .expect(201);

        expect(res.body.buyer_id).toBe(buyer2Id);

        // Cleanup
        await supabase.from("reviews").delete().eq("buyer_id", buyer2Id);
        await supabase.from("orders").delete().eq("buyer_id", buyer2Id);
        await supabase.from("sellers").delete().eq("id", buyer2Id);
    });

    // ============================================================================
    // Test 7: Review summary endpoint returns correct stats
    // ============================================================================
    it("review summary endpoint returns correct aggregated stats", async () => {
        const res = await request(app)
            .get(`/api/products/${productId}/reviews/summary`)
            .expect(200);

        expect(res.body.productId).toBe(productId);
        expect(res.body.totalReviews).toBeGreaterThanOrEqual(1);
        expect(res.body.averageRating).toBeGreaterThanOrEqual(1);
        expect(res.body.averageRating).toBeLessThanOrEqual(5);
        expect(res.body.ratingDistribution).toBeDefined();
    });
});
