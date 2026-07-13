import {
    getCachedDrug,
    incrementHitCount,
    incrementMissCount,
    getCacheStats,
} from "./cache.service";

import { redisClient } from "../utils/redis";

// Mock Redis
jest.mock("../utils/redis", () => ({
    redisClient: {
        isOpen: true,
        get: jest.fn(),
        set: jest.fn().mockResolvedValue("OK"),
        incr: jest.fn(),
        zIncrBy: jest.fn(),
        zRangeWithScores: jest.fn(),
    },
}));

// Mock logger
jest.mock("../utils/logger", () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

describe("cache.service", () => {
    const mockMedicine = {
        id: "drug-123",
        brand_name: "Dolo 650",
        generic_name: "Paracetamol",
        batch_number: "B12345",
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (redisClient.isOpen as boolean) = true;
    });

    describe("getCachedDrug", () => {
        it("should return cached medicine on cache hit", async () => {
            (redisClient.get as jest.Mock)
                .mockResolvedValueOnce(JSON.stringify(mockMedicine))
                .mockResolvedValueOnce("50");

            (redisClient.incr as jest.Mock).mockResolvedValue(1);
            (redisClient.zIncrBy as jest.Mock).mockResolvedValue(1);

            const result = await getCachedDrug("B12345");

            expect(result).toEqual(mockMedicine);
            expect(redisClient.get).toHaveBeenCalledWith("drug:batch:B12345");
        });

        it("should return null on cache miss", async () => {
            (redisClient.get as jest.Mock).mockResolvedValue(null);

            const result = await getCachedDrug("B12345");

            expect(result).toBeNull();
            expect(redisClient.get).toHaveBeenCalledWith("drug:batch:B12345");
        });
    });

    describe("incrementHitCount", () => {
        it("should increment hit counter", async () => {
            (redisClient.incr as jest.Mock).mockResolvedValue(5);
            (redisClient.zIncrBy as jest.Mock).mockResolvedValue(5);

            const result = await incrementHitCount("drug-123", "Dolo 650");

            expect(result).toBe(5);

            expect(redisClient.incr).toHaveBeenCalledWith("hits:drug:drug-123");

            expect(redisClient.zIncrBy).toHaveBeenCalledWith("stats:top_drugs", 1, "Dolo 650");
        });
    });

    describe("incrementMissCount", () => {
        it("should increment miss counter", async () => {
            (redisClient.incr as jest.Mock).mockResolvedValue(8);

            const result = await incrementMissCount();

            expect(result).toBe(8);

            expect(redisClient.incr).toHaveBeenCalledWith("stats:misses");
        });
    });

    describe("redis unavailable", () => {
        it("should safely return null when redis is unavailable", async () => {
            (redisClient.isOpen as boolean) = false;

            const result = await getCachedDrug("B12345");

            expect(result).toBeNull();
        });

        it("should return 0 when incrementHitCount is called while redis is unavailable", async () => {
            (redisClient.isOpen as boolean) = false;

            const result = await incrementHitCount("drug-123");

            expect(result).toBe(0);
        });

        it("should return 0 when incrementMissCount is called while redis is unavailable", async () => {
            (redisClient.isOpen as boolean) = false;

            const result = await incrementMissCount();

            expect(result).toBe(0);
        });
    });

    describe("redis errors", () => {
        it("should handle redis get errors gracefully", async () => {
            (redisClient.get as jest.Mock).mockRejectedValue(new Error("Redis unavailable"));

            const result = await getCachedDrug("B12345");

            expect(result).toBeNull();
        });

        it("should handle incrementHitCount errors", async () => {
            (redisClient.incr as jest.Mock).mockRejectedValue(new Error("Redis unavailable"));

            const result = await incrementHitCount("drug-123");

            expect(result).toBe(0);
        });

        it("should handle incrementMissCount errors", async () => {
            (redisClient.incr as jest.Mock).mockRejectedValue(new Error("Redis unavailable"));

            const result = await incrementMissCount();

            expect(result).toBe(0);
        });
    });

    describe("getCacheStats", () => {
        const mockFetch = jest.fn();
        global.fetch = mockFetch;

        beforeEach(() => {
            mockFetch.mockClear();
            process.env.PG_CRON_MONITOR_WEBHOOK_URL = "http://mock-webhook";
        });

        it("should return live stats and save snapshot on success", async () => {
            (redisClient.get as jest.Mock).mockImplementation((key) => {
                if (key === "stats:snapshot:last_known") return Promise.resolve(null);
                if (key === "stats:hits") return Promise.resolve("10");
                if (key === "stats:misses") return Promise.resolve("5");
                if (key === "stats:tier:hot") return Promise.resolve("2");
                if (key === "stats:tier:warm") return Promise.resolve("3");
                if (key === "stats:tier:cold") return Promise.resolve("5");
                return Promise.resolve(null);
            });
            (redisClient.zRangeWithScores as jest.Mock).mockResolvedValue([
                { value: "Dolo", score: 10 },
            ]);

            const stats = await getCacheStats();

            expect(stats.hits).toBe(10);
            expect(stats.misses).toBe(5);
            expect(stats.hitRate).toBe(67);
            expect(redisClient.set).toHaveBeenCalledWith(
                "stats:snapshot:last_known",
                expect.any(String),
                { EX: 300 }
            );
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it("should return snapshot if live stats partially fail", async () => {
            const staleSnapshot = {
                hits: 100,
                misses: 50,
                hitRate: 67,
                tierBreakdown: { hot: 10, warm: 20, cold: 30 },
                topDrugs: [{ name: "Crocin", count: 100 }],
            };

            (redisClient.get as jest.Mock).mockImplementation((key) => {
                if (key === "stats:snapshot:last_known")
                    return Promise.resolve(JSON.stringify(staleSnapshot));
                if (key === "stats:hits") return Promise.resolve("10");
                if (key === "stats:misses") return Promise.reject(new Error("Redis error"));
                return Promise.resolve("0");
            });
            (redisClient.zRangeWithScores as jest.Mock).mockResolvedValue([]);

            const stats = await getCacheStats();

            expect(stats).toEqual(staleSnapshot);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it("should fire discord alert and return default stats if all fail and no snapshot", async () => {
            // Fast forward time to avoid debounce
            jest.spyOn(Date, "now").mockImplementation(() => 9999999999999);
            mockFetch.mockResolvedValue({ ok: true });

            (redisClient.get as jest.Mock).mockRejectedValue(new Error("Redis is down completely"));
            (redisClient.zRangeWithScores as jest.Mock).mockRejectedValue(
                new Error("Redis is down completely")
            );

            const stats = await getCacheStats();

            expect(stats.hits).toBe(0);
            expect(stats.misses).toBe(0);
            expect(mockFetch).toHaveBeenCalledWith(
                "http://mock-webhook",
                expect.objectContaining({
                    method: "POST",
                })
            );

            jest.restoreAllMocks();
        });
    });
});
