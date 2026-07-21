process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key";

const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockMaybeSingle = jest.fn();
const mockUpsert = jest.fn();

jest.mock("../src/db/client", () => ({
    supabase: {
        rpc: mockRpc,
        from: mockFrom,
    },
}));

const mockRedisClient = {
    isOpen: true,
    get: jest.fn(),
    set: jest.fn(),
};

jest.mock("../src/utils/redis", () => ({
    redisClient: mockRedisClient,
}));

const mockFetchOpenFdaContext = jest.fn();
jest.mock("../src/services/openfda.service", () => ({
    fetchOpenFdaContext: mockFetchOpenFdaContext,
}));

const mockGenerateSafetyProfile = jest.fn();
jest.mock("../src/services/llm.service", () => ({
    generateSafetyProfile: mockGenerateSafetyProfile,
}));

jest.mock("../src/middleware/rateLimit", () => ({
    scanQueryLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock("../src/utils/logger", () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

import express from "express";
import request from "supertest";
import safetyRouter from "../src/routes/safety";

const PROFILE_TTL_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-07-21T12:00:00.000Z");
const cachedProfile = { medicine: "cached profile" };
const generatedProfile = { medicine: "generated profile" };

const app = express();
app.use("/api/medicine/safety", safetyRouter);

function mockDbProfile(data: unknown) {
    mockMaybeSingle.mockResolvedValue({ data, error: null });
}

describe("GET /api/medicine/safety", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers().setSystemTime(NOW);

        mockRpc.mockResolvedValue({
            data: [{ generic_name: "telmisartan" }],
            error: null,
        });
        mockRedisClient.isOpen = true;
        mockRedisClient.get.mockResolvedValue(null);
        mockRedisClient.set.mockResolvedValue("OK");

        mockSelect.mockReturnValue({ eq: mockEq });
        mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
        mockUpsert.mockResolvedValue({ error: null });
        mockFrom.mockReturnValue({
            select: mockSelect,
            upsert: mockUpsert,
        });

        mockFetchOpenFdaContext.mockResolvedValue("current safety context");
        mockGenerateSafetyProfile.mockResolvedValue(generatedProfile);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("returns a Redis hit without querying the database or generator", async () => {
        mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedProfile));

        const res = await request(app).get("/api/medicine/safety?q=Telma");

        expect(res.status).toBe(200);
        expect(res.body).toEqual(cachedProfile);
        expect(res.headers["x-cache-source"]).toBe("redis");
        expect(mockFrom).not.toHaveBeenCalled();
        expect(mockGenerateSafetyProfile).not.toHaveBeenCalled();
    });

    it("returns a fresh database profile and backfills Redis", async () => {
        mockDbProfile({
            profile_json: cachedProfile,
            updated_at: new Date(NOW.getTime() - PROFILE_TTL_MS + 1).toISOString(),
        });

        const res = await request(app).get("/api/medicine/safety?q=Telma");

        expect(res.status).toBe(200);
        expect(res.body).toEqual(cachedProfile);
        expect(res.headers["x-cache-source"]).toBe("supabase");
        expect(mockSelect).toHaveBeenCalledWith("profile_json, updated_at");
        expect(mockGenerateSafetyProfile).not.toHaveBeenCalled();
        expect(mockRedisClient.set).toHaveBeenCalledWith(
            "medicine_safety:telmisartan",
            JSON.stringify(cachedProfile),
            { EX: 86400 }
        );
    });

    it("regenerates and persists a stale database profile", async () => {
        mockDbProfile({
            profile_json: cachedProfile,
            updated_at: new Date(NOW.getTime() - PROFILE_TTL_MS - 1).toISOString(),
        });

        const res = await request(app).get("/api/medicine/safety?q=Telma");

        expect(res.status).toBe(200);
        expect(res.body).toEqual(generatedProfile);
        expect(res.headers["x-cache-source"]).toBe("llm-generated");
        expect(mockGenerateSafetyProfile).toHaveBeenCalledWith(
            "telmisartan",
            "current safety context"
        );
        expect(mockUpsert).toHaveBeenCalledWith(
            {
                generic_name: "telmisartan",
                profile_json: generatedProfile,
                updated_at: NOW.toISOString(),
            },
            { onConflict: "generic_name" }
        );
        expect(mockRedisClient.set).toHaveBeenCalledWith(
            "medicine_safety:telmisartan",
            JSON.stringify(generatedProfile),
            { EX: 86400 }
        );
        expect(mockUpsert.mock.invocationCallOrder[0]).toBeLessThan(
            mockRedisClient.set.mock.invocationCallOrder[0]
        );
    });

    it("preserves generation and persistence when no database profile exists", async () => {
        mockDbProfile(null);

        const res = await request(app).get("/api/medicine/safety?q=Telma");

        expect(res.status).toBe(200);
        expect(res.body).toEqual(generatedProfile);
        expect(mockGenerateSafetyProfile).toHaveBeenCalledTimes(1);
        expect(mockUpsert).toHaveBeenCalledTimes(1);
        expect(mockRedisClient.set).toHaveBeenCalledTimes(1);
    });

    it("treats a profile exactly at the freshness limit as stale", async () => {
        mockDbProfile({
            profile_json: cachedProfile,
            updated_at: new Date(NOW.getTime() - PROFILE_TTL_MS).toISOString(),
        });

        const res = await request(app).get("/api/medicine/safety?q=Telma");

        expect(res.status).toBe(200);
        expect(res.body).toEqual(generatedProfile);
        expect(mockGenerateSafetyProfile).toHaveBeenCalledTimes(1);
        expect(mockUpsert).toHaveBeenCalledTimes(1);
    });
});
