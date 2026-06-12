const mockSupabase = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
};

const mockRedis = {
    isOpen: true,
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    connect: jest.fn(),
};

jest.mock("../src/db/client", () => ({
    supabase: mockSupabase,
}));

jest.mock("../src/utils/redis", () => ({
    redisClient: mockRedis,
    connectRedis: jest.fn(),
}));

import {
    warmCache,
    getTTLForDrug,
    getCachedDrug,
    setCachedDrug,
    incrementHitCount,
    invalidateDrugCache,
    TTL_TIERS,
    HIT_THRESHOLDS,
} from "../src/services/cache.service";
import { lookupDrugByBatch } from "../src/services/drugLookup.service";

describe("Redis Caching and Drug Lookup Services", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRedis.isOpen = true;
    });

    describe("warmCache", () => {
        it("should warm cache with medicines from the database matching the hot seed", async () => {
            const mockMedicines = [
                {
                    id: "med-1",
                    batch_number: "BATCH-1",
                    generic_name: "Paracetamol",
                    brand_name: "Crocin",
                },
            ];

            mockSupabase.or.mockResolvedValueOnce({ data: mockMedicines, error: null });
            mockRedis.get.mockResolvedValue(null);

            await warmCache();

            expect(mockSupabase.from).toHaveBeenCalledWith("medicines");
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
            mockRedis.get.mockResolvedValueOnce(JSON.stringify(mockMed));
            mockRedis.incr.mockResolvedValueOnce(1);

            const result = await getCachedDrug("BATCH-1");

            expect(result).toEqual(mockMed);
            expect(mockRedis.get).toHaveBeenCalledWith("drug:batch:BATCH-1");
            expect(mockRedis.incr).toHaveBeenCalledWith("hits:drug:med-1");
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
        it("should increment the drug hit count key", async () => {
            mockRedis.incr.mockResolvedValueOnce(42);

            const hits = await incrementHitCount("med-1");

            expect(hits).toBe(42);
            expect(mockRedis.incr).toHaveBeenCalledWith("hits:drug:med-1");
        });
    });

    describe("invalidateDrugCache", () => {
        it("should resolve drug IDs to batch numbers and delete cache keys", async () => {
            const mockData = [{ batch_number: "BATCH-1" }, { batch_number: "BATCH-2" }];

            mockSupabase.in.mockResolvedValueOnce({ data: mockData, error: null });

            await invalidateDrugCache(["med-1", "med-2"]);

            expect(mockSupabase.from).toHaveBeenCalledWith("medicines");
            expect(mockRedis.del).toHaveBeenCalledWith([
                "drug:batch:BATCH-1",
                "drug:batch:BATCH-2",
            ]);
        });
    });

    describe("lookupDrugByBatch", () => {
        it("should return cached drug on cache hit and not query database", async () => {
            const mockMed = { id: "med-1", brand_name: "Crocin" };
            mockRedis.get.mockResolvedValueOnce(JSON.stringify(mockMed));

            const result = await lookupDrugByBatch("BATCH-1");

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

            const result = await lookupDrugByBatch("BATCH-1");

            expect(result).toEqual(mockMed);
            expect(mockSupabase.from).toHaveBeenCalledWith("medicines");
            expect(mockRedis.incr).toHaveBeenCalledWith("hits:drug:med-1");
            expect(mockRedis.set).toHaveBeenCalledWith(
                "drug:batch:BATCH-1",
                JSON.stringify(mockMed),
                { EX: TTL_TIERS.COLD }
            );
        });
    });
});
