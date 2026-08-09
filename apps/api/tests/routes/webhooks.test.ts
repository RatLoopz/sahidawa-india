import request from "supertest";
import express from "express";
import webhooksRouter from "../../src/routes/webhooks";
import { redisClient } from "../../src/utils/redis";
import { invalidateCacheByPattern } from "../../src/services/cache.service";
import logger from "../../src/utils/logger";

// Mock the redis client
jest.mock("../../src/utils/redis", () => ({
    redisClient: {
        isOpen: true,
        scan: jest.fn(),
        del: jest.fn(),
    },
}));

// Mock the cache invalidation helper so the route behavior is tested
// in isolation (the SCAN/scanIterator cursor handling itself lives in
// cache.service.ts and is covered by its own tests).
jest.mock("../../src/services/cache.service", () => ({
    invalidateCacheByPattern: jest.fn(),
}));

// Mock the rate limiter so tests don't fail due to too many requests
jest.mock("../../src/middleware/rateLimit", () => ({
    webhookLimiter: (req: any, res: any, next: any) => next(),
}));

// Mock logger to keep test output clean
jest.mock("../../src/utils/logger", () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

const app = express();
app.use(express.json());
app.use("/api/webhooks", webhooksRouter);

describe("Webhooks Routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.SUPABASE_WEBHOOK_SECRET = "test-secret";
        (redisClient as any).isOpen = true;
        (invalidateCacheByPattern as jest.Mock).mockResolvedValue([]);
    });

    describe("Authorization", () => {
        it("returns 401 when authorization header is missing", async () => {
            const res = await request(app).post("/api/webhooks/supabase/health-schemes").send({});

            expect(res.status).toBe(401);
            expect(res.body).toEqual({ error: "Unauthorized" });
        });

        it("returns 401 when authorization header is invalid", async () => {
            const res = await request(app)
                .post("/api/webhooks/supabase/health-schemes")
                .set("Authorization", "Bearer wrong-secret")
                .send({});

            expect(res.status).toBe(401);
            expect(res.body).toEqual({ error: "Unauthorized" });
        });

        it("logs only IP and header names on unauthorized attempts", async () => {
            const res = await request(app)
                .post("/api/webhooks/supabase/medicines")
                .set("Authorization", "Bearer wrong-secret")
                .set("X-Custom-Probe", "should-not-be-logged-as-value")
                .send({});

            expect(res.status).toBe(401);
            expect(logger.warn).toHaveBeenCalled();

            const warnCalls = (logger.warn as jest.Mock).mock.calls;
            const unauthorizedCall = warnCalls.find(
                ([message]) =>
                    typeof message === "string" && message.includes("Unauthorized webhook attempt")
            );
            expect(unauthorizedCall).toBeDefined();

            const meta = unauthorizedCall![1] as Record<string, unknown>;
            expect(meta).toHaveProperty("ip");
            expect(meta).toHaveProperty("headerNames");
            expect(meta).not.toHaveProperty("headers");
            expect(JSON.stringify(meta)).not.toContain("wrong-secret");
            expect(JSON.stringify(meta)).not.toContain("should-not-be-logged-as-value");
            expect(meta.headerNames).toEqual(
                expect.arrayContaining(["authorization", "x-custom-probe"])
            );
        });
    });

    describe("POST /api/webhooks/supabase/health-schemes", () => {
        it("processes valid requests and deletes Redis keys", async () => {
            (invalidateCacheByPattern as jest.Mock).mockResolvedValue([
                "schemes:state:UP",
                "schemes:state:MH",
            ]);

            const res = await request(app)
                .post("/api/webhooks/supabase/health-schemes")
                .set("Authorization", "Bearer test-secret")
                .send({});

            expect(res.status).toBe(200);
            expect(invalidateCacheByPattern).toHaveBeenCalledWith("schemes:state:*");
            expect(res.body).toEqual({
                invalidated: 2,
                keys: ["schemes:state:UP", "schemes:state:MH"],
            });
        });

        it("handles missing cache keys without calling del", async () => {
            (invalidateCacheByPattern as jest.Mock).mockResolvedValue([]);

            const res = await request(app)
                .post("/api/webhooks/supabase/health-schemes")
                .set("Authorization", "Bearer test-secret")
                .send({});

            expect(res.status).toBe(200);
            expect(redisClient.del).not.toHaveBeenCalled();
        });

        it("safely handles disconnected Redis without crashing", async () => {
            (redisClient as any).isOpen = false;

            const res = await request(app)
                .post("/api/webhooks/supabase/health-schemes")
                .set("Authorization", "Bearer test-secret")
                .send({});

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ invalidated: 0, message: "Redis unavailable" });
            expect(invalidateCacheByPattern).not.toHaveBeenCalled();
        });

        it("handles Redis scan errors safely", async () => {
            (invalidateCacheByPattern as jest.Mock).mockRejectedValueOnce(new Error("Redis error"));

            const res = await request(app)
                .post("/api/webhooks/supabase/health-schemes")
                .set("Authorization", "Bearer test-secret")
                .send({});

            expect(res.status).toBe(500);
            expect(res.body).toEqual({ error: "Cache invalidation failed" });
        });
    });

    describe("POST /api/webhooks/supabase/medicines", () => {
        it("invalidates drug lookup and voice search cache", async () => {
            (invalidateCacheByPattern as jest.Mock).mockResolvedValue(["drug:batch:B123:data"]);

            const res = await request(app)
                .post("/api/webhooks/supabase/medicines")
                .set("Authorization", "Bearer test-secret")
                .send({
                    record: {
                        batch_number: "B123",
                        brand_name: "Aspirin Plus",
                        generic_name: "Aspirin",
                    },
                });

            expect(res.status).toBe(200);
            expect(invalidateCacheByPattern).toHaveBeenCalledWith("drug:batch:B123*");
            expect(redisClient.del).toHaveBeenCalled();

            // The keys to delete are the voice-search keys; batch keys are
            // deleted inside invalidateCacheByPattern (the helper DELs as it scans).
            const deletedKeys = (redisClient.del as jest.Mock).mock.calls[0][0];
            expect(deletedKeys).toContain("medicine:voice:aspirin_plus");
            expect(deletedKeys).toContain("medicine:voice:aspirin");
            expect(deletedKeys).not.toContain("drug:batch:B123:data");
        });

        it("invalidates verify-brand cache for brand and generic names", async () => {
            (invalidateCacheByPattern as jest.Mock).mockResolvedValue([]);

            const res = await request(app)
                .post("/api/webhooks/supabase/medicines")
                .set("Authorization", "Bearer test-secret")
                .send({
                    record: {
                        batch_number: "B123",
                        brand_name: "Aspirin Plus",
                        generic_name: "Aspirin",
                    },
                });

            expect(res.status).toBe(200);

            const deletedKeys = (redisClient.del as jest.Mock).mock.calls[0][0];
            expect(deletedKeys).toContain("brand_cache:aspirin plus");
            expect(deletedKeys).toContain("brand_cache:aspirin");
        });

        it("deletes the old brand cache key when the brand is renamed", async () => {
            (invalidateCacheByPattern as jest.Mock).mockResolvedValue([]);

            const res = await request(app)
                .post("/api/webhooks/supabase/medicines")
                .set("Authorization", "Bearer test-secret")
                .send({
                    record: {
                        batch_number: "B123",
                        brand_name: "New Brand",
                        generic_name: "Aspirin",
                    },
                    old_record: {
                        batch_number: "B123",
                        brand_name: "Old Brand",
                        generic_name: "Aspirin",
                    },
                });

            expect(res.status).toBe(200);

            const deletedKeys = (redisClient.del as jest.Mock).mock.calls[0][0];
            expect(deletedKeys).toContain("brand_cache:old brand");
            expect(deletedKeys).toContain("brand_cache:new brand");
        });

        it("deletes the old generic cache key when the generic is renamed", async () => {
            (invalidateCacheByPattern as jest.Mock).mockResolvedValue([]);

            const res = await request(app)
                .post("/api/webhooks/supabase/medicines")
                .set("Authorization", "Bearer test-secret")
                .send({
                    record: {
                        batch_number: "B123",
                        brand_name: "Aspirin Plus",
                        generic_name: "New Generic",
                    },
                    old_record: {
                        batch_number: "B123",
                        brand_name: "Aspirin Plus",
                        generic_name: "Old Generic",
                    },
                });

            expect(res.status).toBe(200);

            const deletedKeys = (redisClient.del as jest.Mock).mock.calls[0][0];
            expect(deletedKeys).toContain("brand_cache:old generic");
            expect(deletedKeys).toContain("brand_cache:new generic");
        });

        it("sweeps all verify-brand cache keys when the counterfeit alert flag changes", async () => {
            (invalidateCacheByPattern as jest.Mock).mockResolvedValue([]);

            const res = await request(app)
                .post("/api/webhooks/supabase/medicines")
                .set("Authorization", "Bearer test-secret")
                .send({
                    record: {
                        batch_number: "B123",
                        brand_name: "Aspirin Plus",
                        is_counterfeit_alert: true,
                    },
                    old_record: {
                        batch_number: "B123",
                        brand_name: "Aspirin Plus",
                        is_counterfeit_alert: false,
                    },
                });

            expect(res.status).toBe(200);
            expect(invalidateCacheByPattern).toHaveBeenCalledWith("brand_cache:*");
        });

        it("sweeps all verify-brand cache keys when the CDSCO verification flag changes", async () => {
            (invalidateCacheByPattern as jest.Mock).mockResolvedValue([]);

            const res = await request(app)
                .post("/api/webhooks/supabase/medicines")
                .set("Authorization", "Bearer test-secret")
                .send({
                    record: {
                        batch_number: "B123",
                        brand_name: "Aspirin Plus",
                        is_cdsco_verified: true,
                        is_counterfeit_alert: false,
                    },
                    old_record: {
                        batch_number: "B123",
                        brand_name: "Aspirin Plus",
                        is_cdsco_verified: false,
                        is_counterfeit_alert: false,
                    },
                });

            expect(res.status).toBe(200);
            expect(invalidateCacheByPattern).toHaveBeenCalledWith("brand_cache:*");
        });

        it("does not sweep brand cache when the counterfeit alert flag is unchanged", async () => {
            (invalidateCacheByPattern as jest.Mock).mockResolvedValue([]);

            const res = await request(app)
                .post("/api/webhooks/supabase/medicines")
                .set("Authorization", "Bearer test-secret")
                .send({
                    record: {
                        batch_number: "B123",
                        brand_name: "Aspirin Plus",
                        is_counterfeit_alert: false,
                    },
                    old_record: {
                        batch_number: "B123",
                        brand_name: "Aspirin Plus",
                        is_counterfeit_alert: false,
                    },
                });

            expect(res.status).toBe(200);
            expect(invalidateCacheByPattern).not.toHaveBeenCalledWith("brand_cache:*");
        });

        it("does not sweep brand cache when verification-related fields are unchanged", async () => {
            (invalidateCacheByPattern as jest.Mock).mockResolvedValue([]);

            const res = await request(app)
                .post("/api/webhooks/supabase/medicines")
                .set("Authorization", "Bearer test-secret")
                .send({
                    record: {
                        batch_number: "B456",
                        brand_name: "Aspirin Plus",
                        is_cdsco_verified: true,
                        is_counterfeit_alert: false,
                    },
                    old_record: {
                        batch_number: "B123",
                        brand_name: "Aspirin Plus",
                        is_cdsco_verified: true,
                        is_counterfeit_alert: false,
                    },
                });

            expect(res.status).toBe(200);
            expect(invalidateCacheByPattern).not.toHaveBeenCalledWith("brand_cache:*");
        });
    });

    describe("POST /api/webhooks/supabase/pharmacies (Async Invalidation)", () => {
        it("returns 200 immediately and dispatches async invalidation", async () => {
            (invalidateCacheByPattern as jest.Mock).mockResolvedValue(["pharmacy:123:details"]);

            const res = await request(app)
                .post("/api/webhooks/supabase/pharmacies")
                .set("Authorization", "Bearer test-secret")
                .send({
                    record: { id: "123" },
                });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                success: true,
                message: "Invalidation event dispatched for pharmacies",
            });

            // Wait a tiny bit for the async promise to resolve
            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(invalidateCacheByPattern).toHaveBeenCalledWith("pharmacy:123*");
        });
    });
});
