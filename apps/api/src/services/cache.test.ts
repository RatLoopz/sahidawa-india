import { getCachedDrug, incrementHitCount, incrementMissCount } from "./cache.service";

import { redisClient } from "../utils/redis";

// Mock Redis
jest.mock("../utils/redis", () => ({
    redisClient: {
        isOpen: true,
        get: jest.fn(),
        set: jest.fn(),
        incr: jest.fn(),
        zIncrBy: jest.fn(),
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
});
