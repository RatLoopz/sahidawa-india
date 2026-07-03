import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../app";
import { supabase } from "../db/client";
import { isTokenRevoked, revokeAllUserTokens } from "../utils/tokenRevocation";
import { v4 as uuidv4 } from "uuid";

describe("Seller Account Deactivation JWT Revocation (Issue #3046)", () => {
    let sellerId: string;
    let sellerToken: string;

    const generateMockToken = (userId: string): string => {
        return Buffer.from(
            JSON.stringify({
                sub: userId,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600,
            })
        ).toString("base64");
    };

    beforeAll(async () => {
        sellerId = uuidv4();
        sellerToken = generateMockToken(sellerId);

        // Create seller account
        await supabase.from("sellers").insert([
            {
                id: sellerId,
                shop_name: "Test Seller Shop",
                is_verified: true,
                is_active: true,
            },
        ]);
    });

    afterAll(async () => {
        // Cleanup
        await supabase.from("token_revocations").delete().eq("user_id", sellerId);
        await supabase.from("sellers").delete().eq("id", sellerId);
    });

    // ============================================================================
    // Test 1: Active seller token is not revoked
    // ============================================================================
    it("active seller token is not revoked", async () => {
        const isRevoked = await isTokenRevoked(sellerId);
        expect(isRevoked).toBe(false);
    });

    // ============================================================================
    // Test 2: Deactivating seller account marks token as revoked
    // ============================================================================
    it("deactivating seller account revokes all tokens", async () => {
        const res = await request(app)
            .post("/api/sellers/me/deactivate")
            .set("Authorization", `Bearer ${sellerToken}`)
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.seller.is_active).toBe(false);

        // Check that token is now revoked
        const isRevoked = await isTokenRevoked(sellerId);
        expect(isRevoked).toBe(true);
    });

    // ============================================================================
    // Test 3: Revoked token is rejected on subsequent requests
    // ============================================================================
    it("revoked token is rejected on subsequent requests", async () => {
        const res = await request(app)
            .get("/api/sellers/me/profile")
            .set("Authorization", `Bearer ${sellerToken}`)
            .expect(401);

        expect(res.body.code).toBe("TOKEN_REVOKED");
    });

    // ============================================================================
    // Test 4: Seller profile shows is_active = false after deactivation
    // ============================================================================
    it("seller profile is marked as inactive after deactivation", async () => {
        const { data: seller } = await supabase
            .from("sellers")
            .select("is_active")
            .eq("id", sellerId)
            .single();

        expect(seller?.is_active).toBe(false);
    });

    // ============================================================================
    // Test 5: Deactivated seller cannot access public seller endpoint
    // ============================================================================
    it("deactivated seller profile not returned in public endpoint", async () => {
        const res = await request(app).get(`/api/sellers/${sellerId}`).expect(404);

        expect(res.body.error).toContain("not found");
    });

    // ============================================================================
    // Test 6: revokeAllUserTokens() function works correctly
    // ============================================================================
    it("revokeAllUserTokens() records revocation in database", async () => {
        const testSellerId = uuidv4();

        // Create test seller
        await supabase.from("sellers").insert([
            {
                id: testSellerId,
                shop_name: "Test Seller 2",
                is_verified: false,
                is_active: true,
            },
        ]);

        // Revoke all tokens
        const success = await revokeAllUserTokens(testSellerId, "test_revocation");
        expect(success).toBe(true);

        // Check that revocation was recorded
        const isRevoked = await isTokenRevoked(testSellerId);
        expect(isRevoked).toBe(true);

        // Cleanup
        await supabase.from("token_revocations").delete().eq("user_id", testSellerId);
        await supabase.from("sellers").delete().eq("id", testSellerId);
    });

    // ============================================================================
    // Test 7: Seller can reactivate account
    // ============================================================================
    it("seller can reactivate deactivated account", async () => {
        // First, reactivate the account (note: old token is still revoked)
        // Create a new seller for this test
        const reactivateSellerId = uuidv4();
        const reactivateToken = generateMockToken(reactivateSellerId);

        await supabase.from("sellers").insert([
            {
                id: reactivateSellerId,
                shop_name: "Reactivation Test Seller",
                is_verified: false,
                is_active: true,
            },
        ]);

        // Deactivate
        await supabase.from("sellers").update({ is_active: false }).eq("id", reactivateSellerId);
        await revokeAllUserTokens(reactivateSellerId, "test");

        // Reactivate (note: this endpoint doesn't require token check since it's a re-auth scenario)
        const res = await request(app)
            .post("/api/sellers/me/reactivate")
            .set("Authorization", `Bearer ${reactivateToken}`)
            .expect(200);

        expect(res.body.seller.is_active).toBe(true);

        // Note: Old token is still revoked, new login would be required in production
        // Old revocations would need to be cleared separately

        // Cleanup
        await supabase.from("token_revocations").delete().eq("user_id", reactivateSellerId);
        await supabase.from("sellers").delete().eq("id", reactivateSellerId);
    });

    // ============================================================================
    // Test 8: Multiple tokens for same user are all revoked
    // ============================================================================
    it("revoking user tokens revokes all tokens for that user", async () => {
        const multiTokenSellerId = uuidv4();
        const token1 = generateMockToken(multiTokenSellerId);
        const token2 = generateMockToken(multiTokenSellerId);

        await supabase.from("sellers").insert([
            {
                id: multiTokenSellerId,
                shop_name: "Multi Token Seller",
                is_verified: false,
                is_active: true,
            },
        ]);

        // Both tokens should work initially
        expect(await isTokenRevoked(multiTokenSellerId)).toBe(false);

        // Revoke all tokens
        await revokeAllUserTokens(multiTokenSellerId, "test_multi_token");

        // Now all tokens are revoked
        expect(await isTokenRevoked(multiTokenSellerId)).toBe(true);

        // Cleanup
        await supabase.from("token_revocations").delete().eq("user_id", multiTokenSellerId);
        await supabase.from("sellers").delete().eq("id", multiTokenSellerId);
    });

    // ============================================================================
    // Test 9: Revocation reason is recorded
    // ============================================================================
    it("revocation reason is stored for audit trail", async () => {
        const auditSellerId = uuidv4();

        await supabase.from("sellers").insert([
            {
                id: auditSellerId,
                shop_name: "Audit Seller",
                is_verified: false,
                is_active: true,
            },
        ]);

        const testReason = "security_incident";
        await revokeAllUserTokens(auditSellerId, testReason);

        // Check that reason is stored
        const { data: revocation } = await supabase
            .from("token_revocations")
            .select("reason")
            .eq("user_id", auditSellerId)
            .limit(1)
            .single();

        expect(revocation?.reason).toBe(testReason);

        // Cleanup
        await supabase.from("token_revocations").delete().eq("user_id", auditSellerId);
        await supabase.from("sellers").delete().eq("id", auditSellerId);
    });
});
