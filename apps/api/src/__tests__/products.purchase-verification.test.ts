import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../app";
import { supabase } from "../db/client";
import { v4 as uuidv4 } from "uuid";

describe("Product CDN Image URL Purchase Verification (Issue #3049)", () => {
    let buyerId: string;
    let sellerId: string;
    let productId: string;
    let buyerToken: string;
    let sellerToken: string;

    // Helper to create auth users (mocked for test)
    const generateMockToken = (userId: string): string => {
        return Buffer.from(
            JSON.stringify({ sub: userId, iat: Math.floor(Date.now() / 1000) })
        ).toString("base64");
    };

    beforeAll(async () => {
        // Generate test UUIDs
        buyerId = uuidv4();
        sellerId = uuidv4();
        productId = uuidv4();
        buyerToken = generateMockToken(buyerId);
        sellerToken = generateMockToken(sellerId);

        // Create sellers entries (mocked users in test)
        await supabase.from("sellers").upsert([
            {
                id: sellerId,
                shop_name: "Test Shop",
                is_verified: true,
            },
            {
                id: buyerId,
                shop_name: "Buyer Shop",
                is_verified: false,
            },
        ]);

        // Create test product with both thumbnail and full image URLs
        const { data } = await supabase
            .from("products")
            .insert([
                {
                    id: productId,
                    seller_id: sellerId,
                    title: "Medical Documentation Bundle",
                    description: "Full medical imaging and documentation",
                    price: 99.99,
                    thumbnail_url: "https://cdn.example.com/products/thumb-12345.jpg",
                    full_image_url:
                        "https://cdn.example.com/products/full-res/medical-imaging-12345.jpg",
                    blur_hash: "UeKUpnxuo~R%0nW;WCnhF6RjaJt757oJodS$",
                    category: "medical",
                    stock: 10,
                    is_active: true,
                },
            ])
            .select();
    });

    afterAll(async () => {
        // Cleanup
        await supabase.from("orders").delete().eq("product_id", productId);
        await supabase.from("products").delete().eq("id", productId);
        await supabase.from("sellers").delete().in("id", [buyerId, sellerId]);
    });

    // ============================================================================
    // Test 1: Unauthenticated users should NOT receive full_image_url
    // ============================================================================
    it("unauthenticated users cannot access full_image_url in product listing", async () => {
        const res = await request(app).get("/api/products").expect(200);

        expect(res.body.products).toBeDefined();
        const product = res.body.products.find((p: any) => p.id === productId);

        if (product) {
            // Thumbnail should be accessible
            expect(product.thumbnail_url).toBe("https://cdn.example.com/products/thumb-12345.jpg");
            // Full image URL should be null for unauthenticated users
            expect(product.full_image_url).toBeNull();
        }
    });

    // ============================================================================
    // Test 2: Authenticated users WITHOUT purchase see only thumbnail_url
    // ============================================================================
    it("authenticated users without purchase cannot access full_image_url", async () => {
        const res = await request(app)
            .get("/api/products")
            .set("Authorization", `Bearer ${buyerToken}`)
            .expect(200);

        const product = res.body.products.find((p: any) => p.id === productId);

        if (product) {
            // Thumbnail should be accessible
            expect(product.thumbnail_url).toBe("https://cdn.example.com/products/thumb-12345.jpg");
            // Full image URL should be null since no purchase was made
            expect(product.full_image_url).toBeNull();
        }
    });

    // ============================================================================
    // Test 3: Authenticated users WITH completed purchase see full_image_url
    // ============================================================================
    it("authenticated users with completed order can access full_image_url", async () => {
        // Create a completed order for the buyer
        const { data: order } = await supabase
            .from("orders")
            .insert([
                {
                    buyer_id: buyerId,
                    product_id: productId,
                    seller_id: sellerId,
                    quantity: 1,
                    price_per_unit: 99.99,
                    total_price: 99.99,
                    status: "completed",
                },
            ])
            .select();

        // Now buyer should see the full image URL
        const res = await request(app)
            .get("/api/products")
            .set("Authorization", `Bearer ${buyerToken}`)
            .expect(200);

        const product = res.body.products.find((p: any) => p.id === productId);

        if (product) {
            expect(product.thumbnail_url).toBe("https://cdn.example.com/products/thumb-12345.jpg");
            // Full image URL should now be accessible
            expect(product.full_image_url).toBe(
                "https://cdn.example.com/products/full-res/medical-imaging-12345.jpg"
            );
        }
    });

    // ============================================================================
    // Test 4: Single product GET endpoint also respects purchase verification
    // ============================================================================
    it("single product GET endpoint respects purchase verification", async () => {
        const noAuthRes = await request(app).get(`/api/products/${productId}`).expect(200);

        expect(noAuthRes.body.thumbnail_url).toBe(
            "https://cdn.example.com/products/thumb-12345.jpg"
        );
        expect(noAuthRes.body.full_image_url).toBeNull();
    });

    // ============================================================================
    // Test 5: Pending/cancelled orders do NOT grant access to full_image_url
    // ============================================================================
    it("pending and cancelled orders do not grant access to full_image_url", async () => {
        // Create a new buyer for this test
        const pendingBuyerId = uuidv4();
        const pendingProductId = uuidv4();

        await supabase.from("sellers").upsert([
            {
                id: pendingBuyerId,
                shop_name: "Pending Buyer",
                is_verified: false,
            },
        ]);

        const { data } = await supabase
            .from("products")
            .insert([
                {
                    id: pendingProductId,
                    seller_id: sellerId,
                    title: "Test Product for Pending Order",
                    description: "Test",
                    price: 50.0,
                    thumbnail_url: "https://cdn.example.com/products/thumb-pending.jpg",
                    full_image_url: "https://cdn.example.com/products/full-pending.jpg",
                    category: "test",
                    stock: 5,
                    is_active: true,
                },
            ])
            .select();

        // Create a pending order
        const pendingToken = generateMockToken(pendingBuyerId);
        await supabase.from("orders").insert([
            {
                buyer_id: pendingBuyerId,
                product_id: pendingProductId,
                seller_id: sellerId,
                quantity: 1,
                price_per_unit: 50.0,
                total_price: 50.0,
                status: "pending",
            },
        ]);

        const res = await request(app)
            .get(`/api/products/${pendingProductId}`)
            .set("Authorization", `Bearer ${pendingToken}`)
            .expect(200);

        // Pending orders should NOT grant access
        expect(res.body.full_image_url).toBeNull();
        expect(res.body.thumbnail_url).toBe("https://cdn.example.com/products/thumb-pending.jpg");

        // Cleanup
        await supabase.from("orders").delete().eq("product_id", pendingProductId);
        await supabase.from("products").delete().eq("id", pendingProductId);
        await supabase.from("sellers").delete().eq("id", pendingBuyerId);
    });

    // ============================================================================
    // Test 6: Product creators see their full images in dashboard
    // ============================================================================
    it("sellers can see their own product full_image_url when creating/editing", async () => {
        // Seller creates a new product
        const newProductData = {
            title: "Seller Only Product",
            description: "Test product for seller dashboard",
            price: 75.0,
            thumbnail_url: "https://cdn.example.com/products/thumb-seller.jpg",
            full_image_url: "https://cdn.example.com/products/full-seller.jpg",
            category: "test",
            stock: 3,
        };

        const res = await request(app)
            .post("/api/products")
            .set("Authorization", `Bearer ${sellerToken}`)
            .send(newProductData)
            .expect(201);

        expect(res.body.id).toBeDefined();
        expect(res.body.full_image_url).toBe(newProductData.full_image_url);

        // Cleanup
        if (res.body.id) {
            await supabase.from("products").delete().eq("id", res.body.id);
        }
    });
});
