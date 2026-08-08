import { redisClient } from "../src/utils/redis";

const mockedRedis = jest.mocked(redisClient);

// botDetection skips when NODE_ENV === "test". We need to override it so the
// middleware actually runs its logic during tests.
const OLD_ENV = process.env.NODE_ENV;

beforeEach(() => {
    process.env.NODE_ENV = "development";
    jest.clearAllMocks();
});

afterAll(() => {
    process.env.NODE_ENV = OLD_ENV;
});

function makeReq(overrides: Record<string, unknown> = {}) {
    return {
        ip: "1.2.3.4",
        headers: {
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "accept-language": "en-US",
            "accept-encoding": "gzip, deflate, br",
            "sec-ch-ua": '"Chromium";v="120"',
            "sec-ch-ua-platform": '"Windows"',
            ...overrides,
        },
    } as any;
}

function makeRes() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    } as any;
}

function makeNext() {
    return jest.fn();
}

describe("botDetection", () => {
    // Must import lazily AFTER setting NODE_ENV so the early-return guard is
    // bypassed during module evaluation.
    let botDetection: typeof import("../src/middleware/botDetection").botDetection;

    beforeAll(async () => {
        // Dynamic import so NODE_ENV is already overridden when the module loads.
        const mod = await import("../src/middleware/botDetection");
        botDetection = mod.botDetection;
    });

    describe("fingerprint consistency (#4221)", () => {
        it("awards fingerprint score when Redis returns a matching fingerprint", async () => {
            const fp = 'en-US|gzip, deflate, br|"Chromium";v="120"|"Windows"';
            (mockedRedis.get as jest.Mock).mockResolvedValue(fp);

            const req = makeReq();
            const res = makeRes();
            const next = makeNext();

            await botDetection()(req, res, next);

            expect(mockedRedis.get).toHaveBeenCalledWith("bot:fp:1.2.3.4");
            expect(mockedRedis.setEx).toHaveBeenCalledWith("bot:fp:1.2.3.4", 3600, fp);
            expect(req.botScore).toBeGreaterThanOrEqual(10);
            expect(req.isLikelyBot).toBe(false);
            expect(next).toHaveBeenCalled();
        });

        it("does not award fingerprint score when Redis returns a different fingerprint", async () => {
            (mockedRedis.get as jest.Mock).mockResolvedValue("old-fingerprint");

            const req = makeReq();
            const res = makeRes();
            const next = makeNext();

            await botDetection()(req, res, next);

            expect(mockedRedis.get).toHaveBeenCalledWith("bot:fp:1.2.3.4");
            expect(req.botScore).toBe(0);
            expect(next).toHaveBeenCalled();
        });

        it("does not award fingerprint score on first request (no previous fingerprint)", async () => {
            (mockedRedis.get as jest.Mock).mockResolvedValue(null);

            const req = makeReq();
            const res = makeRes();
            const next = makeNext();

            await botDetection()(req, res, next);

            expect(mockedRedis.get).toHaveBeenCalledWith("bot:fp:1.2.3.4");
            expect(req.botScore).toBe(0);
            expect(next).toHaveBeenCalled();
        });

        it("continues gracefully when Redis GET fails", async () => {
            (mockedRedis.get as jest.Mock).mockRejectedValue(new Error("Redis unavailable"));

            const req = makeReq();
            const res = makeRes();
            const next = makeNext();

            // Must not throw
            await expect(botDetection()(req, res, next)).resolves.toBeUndefined();

            expect(next).toHaveBeenCalled();
            // Fingerprint score should remain 0 (safe default)
            expect(req.botScore).toBe(0);
        });

        it("continues gracefully when Redis SETEx fails", async () => {
            (mockedRedis.get as jest.Mock).mockResolvedValue(null);
            (mockedRedis.setEx as jest.Mock).mockRejectedValue(new Error("Redis write failed"));

            const req = makeReq();
            const res = makeRes();
            const next = makeNext();

            // Must not throw — setEx is fire-and-forget with .catch()
            await expect(botDetection()(req, res, next)).resolves.toBeUndefined();

            expect(next).toHaveBeenCalled();
        });
    });

    describe("User-Agent heuristic", () => {
        it("flags missing/short user-agent", async () => {
            (mockedRedis.get as jest.Mock).mockResolvedValue(null);

            const req = makeReq({ "user-agent": "" });
            const res = makeRes();
            const next = makeNext();

            await botDetection()(req, res, next);

            expect(req.botScore).toBeGreaterThanOrEqual(30);
            expect(next).toHaveBeenCalled();
        });

        it("flags known bot user-agent patterns", async () => {
            (mockedRedis.get as jest.Mock).mockResolvedValue(null);

            const req = makeReq({ "user-agent": "python-requests/2.28.0" });
            const res = makeRes();
            const next = makeNext();

            await botDetection()(req, res, next);

            expect(req.botScore).toBeGreaterThanOrEqual(40);
            expect(next).toHaveBeenCalled();
        });
    });

    describe("blocking", () => {
        it("returns 403 when blockBots is true and bot detected", async () => {
            (mockedRedis.get as jest.Mock).mockResolvedValue(null);

            // "curl" is short (< 10) → +30 and matches BOT_UA_PATTERNS → +40 = 70 total
            const req = makeReq({ "user-agent": "curl" });
            const res = makeRes();
            const next = makeNext();

            await botDetection({ blockBots: true })(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.any(String) })
            );
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe("skip in test environment", () => {
        it("skips detection when NODE_ENV is test", async () => {
            process.env.NODE_ENV = "test";

            const req = makeReq();
            const res = makeRes();
            const next = makeNext();

            // Re-import won't help; the check is at runtime, not module load.
            // Just call the factory directly.
            const mod = await import("../src/middleware/botDetection");
            await mod.botDetection()(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.botScore).toBeUndefined();
            expect(mockedRedis.get).not.toHaveBeenCalled();

            process.env.NODE_ENV = "development";
        });
    });
});
