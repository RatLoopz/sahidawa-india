process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-role-key";
process.env.ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://example.com";
process.env.API_SECRET_KEY = process.env.API_SECRET_KEY || "test-secret-key";
process.env.CSRF_SECRET = process.env.CSRF_SECRET || "test-csrf-secret-key-32-chars-long-or-more";
// Register a dummy WebSocket implementation to bypass Node 20 Supabase initialization crash
(global as any).WebSocket = class {};

// Mock Redis for rate limiters that use RedisStore
jest.mock("../src/utils/redis", () => ({
    redisClient: {
        isOpen: true,
        get: jest.fn(),
        set: jest.fn().mockResolvedValue("OK"),
        setEx: jest.fn().mockResolvedValue("OK"),
        del: jest.fn().mockResolvedValue(1),
        incr: jest.fn().mockResolvedValue(1),
        zIncrBy: jest.fn().mockResolvedValue(1),
        zRangeWithScores: jest.fn(),
        expire: jest.fn().mockResolvedValue(true),
        connect: jest.fn().mockResolvedValue(true),
        on: jest.fn(),
        sendCommand: jest.fn(),
        scanIterator: jest.fn(),
    },
    connectRedis: jest.fn(),
}));

// Mock rateLimit module to provide a mock buildStore and pass-through limiters
jest.mock("../src/middleware/rateLimit", () => {
    const mockStore = {
        increment: jest.fn().mockResolvedValue({ totalHits: 1, resetTime: Date.now() + 60000 }),
        decrement: jest.fn().mockResolvedValue(undefined),
        resetKey: jest.fn().mockResolvedValue(undefined),
        resetAll: jest.fn().mockResolvedValue(undefined),
    };

    const passThroughLimiter = jest.fn((req, res, next) => next());

    return {
        buildStore: jest.fn(() => mockStore),
        verifyLimiter: passThroughLimiter,
        batchLimiter: passThroughLimiter,
        limiter: passThroughLimiter,
        reportLimiter: passThroughLimiter,
        lasaLimiter: passThroughLimiter,
        scanQueryLimiter: passThroughLimiter,
        compareLimiter: passThroughLimiter,
        interactionCheckLimiter: passThroughLimiter,
        interactionIdsLimiter: passThroughLimiter,
        eligibilityLimiter: passThroughLimiter,
        triageLimiter: passThroughLimiter,
        analyticsLimiter: passThroughLimiter,
        authLimiter: passThroughLimiter,
        authTargetLimiter: passThroughLimiter,
        notificationRegisterLimiter: passThroughLimiter,
        trackingLimiter: passThroughLimiter,
        webhookLimiter: passThroughLimiter,
        barcodeLimiter: passThroughLimiter,
        scheduleLimiter: passThroughLimiter,
        alertsReadLimiter: passThroughLimiter,
        apiKeyLimiter: passThroughLimiter,
        healthLimiter: passThroughLimiter,
        authTargetKeyGenerator: jest.fn(),
    };
});
