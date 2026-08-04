// @ts-nocheck
jest.mock("../src/db/client", () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(),
    },
}));

jest.mock("../src/utils/redis", () => ({
    redisClient: {
        isOpen: true,
        get: jest.fn(),
        set: jest.fn().mockResolvedValue("OK"),
        del: jest.fn().mockResolvedValue(1),
        incr: jest.fn().mockResolvedValue(1),
        zIncrBy: jest.fn().mockResolvedValue(1),
        zRangeWithScores: jest.fn(),
        expire: jest.fn().mockResolvedValue(true),
        connect: jest.fn().mockResolvedValue(true),
        on: jest.fn(),
        scanIterator: jest.fn(),
    },
    connectRedis: jest.fn(),
}));

import { supabase } from "../src/db/client";
import { redisClient } from "../src/utils/redis";
import {
    warmCache,
    getTTLForDrug,
    getCachedDrug,
    setCachedDrug,
    incrementHitCount,
    incrementMissCount,
    invalidateDrugCache,
    getCacheStats,
    TTL_TIERS,
    HIT_THRESHOLDS,
} from "../src/services/cache.service";
import { lookupDrugByBatch } from "../src/services/drugLookup.service";

const mockSupabase = supabase as any;
const mockRedis = redisClient as any;

describe("Redis Caching and Drug Lookup Services", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRedis.isOpen = true;
    });

    describe("warmCache", () => {
        it("should warm cache with medicines from the database matching the hot seed and keep CDSCO evidence fields", async () => {
            const mockMedicines = [
                {
                    id: "med-1",
                    batch_number: "BATCH-1",
                    generic_name: "Paracetamol",
                    brand_name: "Crocin",
                    is_cdsco_verified: true,
                    cdsco_match_score: 98.4,
                    matched_cdsco_product: "Crocin 500",
                    matched_cdsco_manufacturer: "GSK",
                    product_match_score: 97,
                    manufacturer_match_score: 100,
                },
            ];

            mockSupabase.or.mockResolvedValueOnce({ data: mockMedicines, error: null });
            mockRedis.get.mockResolvedValue(null);

            await warmCache();

            expect(mockSupabase.from).toHaveBeenCalledWith("medicines");
            expect(mockSupabase.or).toHaveBeenCalledTimes(1);
            expect(mockSupabase.or).toHaveBeenCalledWith(
                expect.stringMatching(/generic_name\.in\..*brand_name\.in\./)
            );
            expect(mockRedis.set).toHaveBeenCalledWith(
                "drug:batch:BATCH-1",
                JSON.stringify(mockMedicines[0]),
                { EX: TTL_TIERS.HOT }
            );
            expect(mockRedis.set).toHaveBeenCalledWith(
                "hits:drug:med-1",
                String(HIT_THRESHOLDS.HOT)
            );
        });

        it("should skip cache warming if redis is not connected", async () => {
            mockRedis.isOpen = false;

            await warmCache();

            expect(mockSupabase.from).not.toHaveBeenCalled();
        });
    });

    describe("getTTLForDrug", () => {
        it("should return HOT TTL if hit count is above HOT threshold", async () => {
            mockRedis.get.mockResolvedValueOnce(String(HIT_THRESHOLDS.HOT + 5));

            const ttl = await getTTLForDrug("drug-id");

            expect(ttl).toBe(TTL_TIERS.HOT);
        });

        it("should return WARM TTL if hit count is between WARM and HOT threshold", async () => {
            mockRedis.get.mockResolvedValueOnce(String(HIT_THRESHOLDS.WARM + 2));

            const ttl = await getTTLForDrug("drug-id");

            expect(ttl).toBe(TTL_TIERS.WARM);
        });

        it("should return COLD TTL if hit count is below WARM threshold", async () => {
            mockRedis.get.mockResolvedValueOnce("3");

            const ttl = await getTTLForDrug("drug-id");

            expect(ttl).toBe(TTL_TIERS.COLD);
        });
    });

    describe("getCachedDrug", () => {
        it("should return parsed drug data and increment hits count on cache hit", async () => {
            const mockMed = { id: "med-1", brand_name: "Crocin" };
            mockRedis.get.mockResolvedValueOnce(JSON.stringify(mockMed)); // Cache lookup
            mockRedis.get.mockResolvedValueOnce(null); // TTL tier check
            mockRedis.incr.mockResolvedValue(1);
            mockRedis.zIncrBy.mockResolvedValue(1);

            const result = await getCachedDrug("BATCH-1");

            expect(result).toEqual(mockMed);
            expect(mockRedis.get).toHaveBeenCalledWith("drug:batch:BATCH-1");
            expect(mockRedis.incr).toHaveBeenCalledWith("hits:drug:med-1");
            expect(mockRedis.incr).toHaveBeenCalledWith("stats:hits");
            expect(mockRedis.incr).toHaveBeenCalledWith("stats:tier:cold");
            expect(mockRedis.zIncrBy).toHaveBeenCalledWith("stats:top_drugs", 1, "Crocin");
        });

        it("should return null on cache miss", async () => {
            mockRedis.get.mockResolvedValueOnce(null);

            const result = await getCachedDrug("BATCH-1");

            expect(result).toBeNull();
        });
    });

    describe("setCachedDrug", () => {
        it("should cache drug with the corresponding TTL", async () => {
            mockRedis.get.mockResolvedValueOnce(String(HIT_THRESHOLDS.WARM)); // hits
            const mockMed = { id: "med-1", brand_name: "Crocin" };

            await setCachedDrug("BATCH-1", mockMed);

            expect(mockRedis.set).toHaveBeenCalledWith(
                "drug:batch:BATCH-1",
                JSON.stringify(mockMed),
                { EX: TTL_TIERS.WARM }
            );
        });
    });

    describe("incrementHitCount", () => {
        it("should increment the drug hit count key and update sorted set", async () => {
            mockRedis.incr.mockResolvedValueOnce(42);
            mockRedis.zIncrBy.mockResolvedValueOnce(42);

            const hits = await incrementHitCount("med-1", "Crocin");

            expect(hits).toBe(42);
            expect(mockRedis.incr).toHaveBeenCalledWith("hits:drug:med-1");
            expect(mockRedis.zIncrBy).toHaveBeenCalledWith("stats:top_drugs", 1, "Crocin");
        });
    });

    describe("invalidateDrugCache", () => {
        it("should resolve drug IDs to batch numbers and delete cache keys using pattern matching", async () => {
            const mockData = [{ batch_number: "BATCH-1" }, { batch_number: "BATCH-2" }];

            mockSupabase.in.mockReturnThis();
            mockSupabase.limit.mockResolvedValueOnce({ data: mockData, error: null });

            // Mock scanIterator to return composite keys for each batch
            mockRedis.scanIterator
                .mockImplementationOnce(function* () {
                    yield ["drug:batch:BATCH-1", "drug:batch:BATCH-1|barcode1|Brand1"];
                })
                .mockImplementationOnce(function* () {
                    yield ["drug:batch:BATCH-2", "drug:batch:BATCH-2|barcode2|Brand2"];
                });

            const deletedKeys = await invalidateDrugCache(["med-1", "med-2"]);

            expect(mockSupabase.from).toHaveBeenCalledWith("medicines");
            // Verify scanIterator was called with correct patterns
            expect(mockRedis.scanIterator).toHaveBeenCalledTimes(2);
            expect(mockRedis.scanIterator).toHaveBeenNthCalledWith(1, {
                MATCH: "drug:batch:BATCH-1*",
                COUNT: 100,
            });
            expect(mockRedis.scanIterator).toHaveBeenNthCalledWith(2, {
                MATCH: "drug:batch:BATCH-2*",
                COUNT: 100,
            });
            // Verify all keys were deleted
            expect(deletedKeys).toEqual([
                "drug:batch:BATCH-1",
                "drug:batch:BATCH-1|barcode1|Brand1",
                "drug:batch:BATCH-2",
                "drug:batch:BATCH-2|barcode2|Brand2",
            ]);
        });
    });

    describe("lookupDrugByBatch", () => {
        it("should return cached drug on cache hit and not query database", async () => {
            const mockMed = {
                id: "med-1",
                brand_name: "Crocin",
                is_cdsco_verified: true,
                cdsco_match_score: 98.4,
                matched_cdsco_product: "Crocin 500",
                matched_cdsco_manufacturer: "GSK",
                product_match_score: 97,
                manufacturer_match_score: 100,
            };
            mockRedis.get.mockResolvedValueOnce(JSON.stringify(mockMed));

            const result = await lookupDrugByBatch("BATCH-1", { brand_name: "Crocin" });

            expect(result).toEqual(mockMed);
            expect(mockSupabase.from).not.toHaveBeenCalled();
        });

        it("should query database and cache result on cache miss", async () => {
            const mockMed = { id: "med-1", brand_name: "Crocin", batch_number: "BATCH-1" };

            // First mockRedis.get is for getCachedDrug (cache miss)
            mockRedis.get.mockResolvedValueOnce(null);
            // Second mockRedis.get is for getTTLForDrug inside setCachedDrug
            mockRedis.get.mockResolvedValueOnce("0");

            mockSupabase.maybeSingle.mockResolvedValueOnce({ data: mockMed, error: null });
            mockRedis.incr.mockResolvedValue(1);
            mockRedis.zIncrBy.mockResolvedValue(1);

            const result = await lookupDrugByBatch("BATCH-1", { brand_name: "Crocin" });

            expect(result).toEqual(mockMed);
            expect(mockSupabase.from).toHaveBeenCalledWith("medicines");
            expect(mockRedis.incr).toHaveBeenCalledWith("stats:misses");
            expect(mockRedis.incr).toHaveBeenCalledWith("hits:drug:med-1");
            expect(mockRedis.zIncrBy).toHaveBeenCalledWith("stats:top_drugs", 1, "Crocin");
            expect(mockRedis.set).toHaveBeenCalledWith(
                "drug:batch:BATCH-1||Crocin",
                JSON.stringify(mockMed),
                { EX: TTL_TIERS.COLD }
            );
        });
    });

    describe("incrementMissCount", () => {
        it("should increment the global miss counter", async () => {
            mockRedis.incr.mockResolvedValueOnce(5);

            const misses = await incrementMissCount();

            expect(misses).toBe(5);
            expect(mockRedis.incr).toHaveBeenCalledWith("stats:misses");
        });
    });

    describe("getCacheStats", () => {
        it("should return correct cache statistics from Redis", async () => {
            mockRedis.get.mockImplementation(async (key) => {
                if (key === "stats:snapshot:last_known") return null;
                if (key === "stats:hits") return "80";
                if (key === "stats:misses") return "20";
                if (key === "stats:tier:hot") return "40";
                if (key === "stats:tier:warm") return "30";
                if (key === "stats:tier:cold") return "10";
                return null;
            });

            mockRedis.zRangeWithScores.mockImplementation(async () => [
                { value: "Paracetamol", score: 50 },
                { value: "Crocin", score: 30 },
            ]);

            const stats = await getCacheStats();

            expect(stats).toEqual({
                hits: 80,
                misses: 20,
                hitRate: 80,
                tierBreakdown: { hot: 40, warm: 30, cold: 10 },
                topDrugs: [
                    { name: "Paracetamol", count: 50 },
                    { name: "Crocin", count: 30 },
                ],
            });

            expect(mockRedis.get).toHaveBeenCalledWith("stats:hits");
            expect(mockRedis.get).toHaveBeenCalledWith("stats:misses");
            expect(mockRedis.get).toHaveBeenCalledWith("stats:tier:hot");
            expect(mockRedis.get).toHaveBeenCalledWith("stats:tier:warm");
            expect(mockRedis.get).toHaveBeenCalledWith("stats:tier:cold");
            expect(mockRedis.zRangeWithScores).toHaveBeenCalledWith("stats:top_drugs", 0, 9, {
                REV: true,
            });
        });
    });
});
