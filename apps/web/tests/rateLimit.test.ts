/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */

describe("rateLimit", () => {
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...ORIGINAL_ENV };
        delete process.env.UPSTASH_REDIS_REST_URL;
        delete process.env.UPSTASH_REDIS_REST_TOKEN;
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    it("throws in production when limit() is called and credentials are missing", async () => {
        process.env.NODE_ENV = "production";
        const { rateLimit } = require("@/lib/rateLimit");

        await expect(rateLimit.limit("test-key")).rejects.toThrow(
            "Missing Upstash Redis rate limit configuration in production"
        );
    });

    it("does not throw in development when Upstash credentials are missing", () => {
        process.env.NODE_ENV = "development";

        expect(() => {
            require("@/lib/rateLimit");
        }).not.toThrow();
    });

    it("does not throw in test when Upstash credentials are missing", () => {
        process.env.NODE_ENV = "test";

        expect(() => {
            require("@/lib/rateLimit");
        }).not.toThrow();
    });

    it("returns a mock rate limiter in non-production without credentials", async () => {
        process.env.NODE_ENV = "development";

        const { rateLimit } = require("@/lib/rateLimit");
        const result = await rateLimit.limit("test-key");

        expect(result.success).toBe(true);
    });
});
