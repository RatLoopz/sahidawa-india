/**
 * rateLimitFallback.test.ts
 *
 * Tests for the distributed rate-limiting middleware (Issue #2400).
 *
 * Covers:
 *  1. Fallback to in-memory store when REDIS_URL is not set
 *  2. Fallback to in-memory store when REDIS_URL is set but Redis is disconnected
 *  3. Redis store is selected when REDIS_URL is set AND Redis client is open
 *  4. Correct logger calls (info vs warn) per scenario
 *  5. Rate-limit enforcement: 429 after max requests with correct JSON body
 *  6. retryAfter field included in 429 response
 *  7. Server remains healthy (non-crash) when Redis is unavailable
 */

// ── Top-level mocks (hoisted by Jest's babel transform) ───────────────────
jest.mock("../src/utils/redis", () => ({
    redisClient: {
        isOpen: false,
        sendCommand: jest.fn(),
    },
    connectRedis: jest.fn().mockResolvedValue(undefined),
}));

// Mock the RedisStore class to prevent real Redis initialization
// (real init fires an async SCRIPT LOAD command that the mock can't handle,
//  which emits an unhandled async error and causes Jest to exit with code 1
//  even when all tests pass).
jest.mock("rate-limit-redis", () => ({
    RedisStore: jest.fn().mockImplementation(() => ({
        init: jest.fn().mockResolvedValue(undefined),
        increment: jest.fn().mockResolvedValue({ totalHits: 1, resetTime: new Date() }),
        decrement: jest.fn().mockResolvedValue(undefined),
        resetKey: jest.fn().mockResolvedValue(undefined),
    })),
}));

jest.mock("../src/utils/logger", () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        log: jest.fn(),
    },
}));

jest.mock("../src/db/client", () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    },
    dbConfig: { isSupabaseOffline: false },
}));

import request from "supertest";

// ── Helper: load rateLimit module in a fresh isolated scope ───────────────
// jest.isolateModules() is the ONLY correct way to reload a module with
// fresh mocks after top-level jest.mock() calls have already been applied.
function loadRateLimitIsolated(redisIsOpen: boolean): Promise<{
    mod: typeof import("../src/middleware/rateLimit");
    logger: { info: jest.Mock; warn: jest.Mock; error: jest.Mock; log: jest.Mock };
}> {
    return new Promise((resolve, reject) => {
        jest.isolateModules(() => {
            try {
                // jest.doMock (not jest.mock) so the isOpen state is applied at runtime
                // inside the isolated module registry instead of being hoisted once.
                jest.doMock("../src/utils/redis", () => ({
                    __esModule: true,
                    redisClient: {
                        isOpen: redisIsOpen,
                        sendCommand: jest.fn(),
                    },
                    connectRedis: jest.fn().mockResolvedValue(undefined),
                }));
                const mod = require("../src/middleware/rateLimit");
                // Capture the logger instance from THIS isolated scope
                // (the outer mockLogger is a different registry instance)
                const logger = require("../src/utils/logger").default;
                resolve({ mod, logger });
            } catch (err) {
                reject(err);
            }
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
describe("createDistributedLimiter — store selection", () => {
    const originalRedisUrl = process.env.REDIS_URL;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        if (originalRedisUrl === undefined) {
            delete process.env.REDIS_URL;
        } else {
            process.env.REDIS_URL = originalRedisUrl;
        }
    });

    it("uses in-memory store and logs a WARNING when REDIS_URL is not set", async () => {
        delete process.env.REDIS_URL;

        const {
            mod: { interactionCheckLimiter },
            logger,
        } = await loadRateLimitIsolated(false);

        expect(typeof interactionCheckLimiter).toBe("function");
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining("falling back to in-memory store")
        );
        expect(logger.info).not.toHaveBeenCalledWith(
            expect.stringContaining("Redis distributed store")
        );
    });

    it("uses in-memory store and logs a WARNING when REDIS_URL is set but client is NOT connected", async () => {
        process.env.REDIS_URL = "redis://localhost:6379";

        const {
            mod: { interactionCheckLimiter },
            logger,
        } = await loadRateLimitIsolated(false);

        expect(typeof interactionCheckLimiter).toBe("function");
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining("falling back to in-memory store")
        );
    });

    it("uses Redis distributed store and logs INFO when REDIS_URL is set AND client is connected", async () => {
        process.env.REDIS_URL = "redis://localhost:6379";

        const {
            mod: { interactionCheckLimiter },
            logger,
        } = await loadRateLimitIsolated(true);

        expect(typeof interactionCheckLimiter).toBe("function");
        expect(logger.info).toHaveBeenCalledWith(
            expect.stringContaining("Redis distributed store")
        );
        expect(logger.warn).not.toHaveBeenCalledWith(
            expect.stringContaining("falling back to in-memory store")
        );
    });

    it("ALL limiters fall back gracefully when Redis is unavailable", async () => {
        delete process.env.REDIS_URL;

        const { mod } = await loadRateLimitIsolated(false);

        const limiters = [
            mod.verifyLimiter,
            mod.batchLimiter,
            mod.limiter,
            mod.reportLimiter,
            mod.lasaLimiter,
            mod.scanQueryLimiter,
            mod.interactionCheckLimiter,
        ];

        // Every limiter should be a valid Express middleware function
        limiters.forEach((limiterFn) => {
            expect(typeof limiterFn).toBe("function");
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("interactionCheckLimiter — HTTP behavior", () => {
    // Import app once — it uses the top-level mocked redis (isOpen: false)
    // so it will always use in-memory limiters here.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const app = require("../src/app").default;

    it("returns 400 (not 500) for invalid body — server is healthy with in-memory limiter", async () => {
        const res = await request(app)
            .post("/api/v1/interactions/check")
            .send({ medicines: ["only-one"] });

        // 400 means the request reached the handler — server did NOT crash
        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Invalid request body");
    });

    it("returns 429 with retryAfter after exceeding in-memory rate limit", async () => {
        // Fire 11 requests (limit is 10 per minute)
        const responses = await Promise.all(
            Array.from({ length: 11 }, () =>
                request(app)
                    .post("/api/v1/interactions/check")
                    // eslint-disable-next-line sonarjs/no-hardcoded-ip
                    .set("X-Forwarded-For", "192.168.1.1") // same IP = same rate-limit key
                    .send({ medicines: ["crocin", "warfarin"] })
            )
        );

        const statuses = responses.map((r) => r.status);
        const rateLimited = responses.find((r) => r.status === 429);

        // At least one request should be rate-limited
        expect(statuses).toContain(429);

        // 429 response must include retryAfter
        expect(rateLimited?.body).toHaveProperty("retryAfter");
        expect(typeof rateLimited?.body.retryAfter).toBe("number");
        expect(rateLimited?.body.retryAfter).toBeGreaterThan(0);
    });

    it("429 response includes the correct error message", async () => {
        const responses = await Promise.all(
            Array.from({ length: 11 }, () =>
                request(app)
                    .post("/api/v1/interactions/check")
                    // eslint-disable-next-line sonarjs/no-hardcoded-ip
                    .set("X-Forwarded-For", "10.0.0.1")
                    .send({ medicines: ["aspirin", "ibuprofen"] })
            )
        );

        const rateLimited = responses.find((r) => r.status === 429);
        expect(rateLimited?.body.error).toBe(
            "Too many interaction check requests. Please try again later."
        );
    });

    it("standard rate-limit response headers are present on a normal request", async () => {
        const res = await request(app)
            .post("/api/v1/interactions/check")
            // eslint-disable-next-line sonarjs/no-hardcoded-ip
            .set("X-Forwarded-For", "172.16.0.1")
            .send({ medicines: ["crocin", "warfarin"] });

        // standardHeaders: true — RateLimit-* headers per RFC 6585
        expect(res.headers).toHaveProperty("ratelimit-limit");
        expect(res.headers).toHaveProperty("ratelimit-remaining");
    });
});
