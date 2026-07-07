import request from "supertest";
import crypto from "crypto";
// Import the express app server entry instance using standard mock directory pattern
import app from "../app";
import { redisClient } from "../utils/redis";

jest.mock("../utils/redis", () => ({
    redisClient: {
        isOpen: true,
        scan: jest.fn(),
        del: jest.fn(),
    },
}));

describe("Supabase Webhook Multi-Model Cache Invalidation Test Suite", () => {
    const mockSecret = "test_webhook_secret_key_123";
    let originalSecret: string | undefined;

    beforeAll(() => {
        originalSecret = process.env.SUPABASE_WEBHOOK_SECRET;
        process.env.SUPABASE_WEBHOOK_SECRET = mockSecret;
    });

    afterAll(() => {
        process.env.SUPABASE_WEBHOOK_SECRET = originalSecret;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should process asynchronous invalidation payload for pharmacies table and trigger redis cleanup", async () => {
        (redisClient.scan as jest.Mock)
            .mockResolvedValueOnce({ cursor: 12, keys: ["pharmacy:xyz_store"] })
            .mockResolvedValueOnce({ cursor: 0, keys: [] });

        const response = await request(app)
            .post("/api/webhooks/supabase/pharmacies")
            .set("Authorization", `Bearer ${mockSecret}`)
            .send({
                type: "UPDATE",
                table: "pharmacies",
                record: { id: "xyz_store" },
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        // Allow microtask cycle processing loop delay allocation for async blocks
        await new Promise((resolve) => setImmediate(resolve));
        expect(redisClient.scan).toHaveBeenCalled();
        expect(redisClient.del).toHaveBeenCalledWith(["pharmacy:xyz_store"]);
    });

    it("should return a 401 unauthorized status error variant when token signatures mismatch", async () => {
        const response = await request(app)
            .post("/api/webhooks/supabase/pharmacies")
            .set("Authorization", "Bearer invalid_secret_token")
            .send({ type: "INSERT" });

        expect(response.status).toBe(401);
    });
});
