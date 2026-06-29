import { lookupDrugByBatch, ServiceUnavailableError } from "./drugLookup.service";
import { supabase } from "../db/client";
import {
    getCachedDrug,
    setCachedDrug,
    incrementHitCount,
    incrementMissCount,
} from "./cache.service";

// Declare mock functions that can be configured in tests
const mockMaybeSingle = jest.fn();

// Mock Supabase database client
jest.mock("../db/client", () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: () => mockMaybeSingle(),
    },
}));

// Mock Cache service
jest.mock("./cache.service", () => ({
    getCachedDrug: jest.fn(),
    setCachedDrug: jest.fn(),
    incrementHitCount: jest.fn(),
    incrementMissCount: jest.fn(),
}));

// Mock logger to avoid cluttering test outputs
jest.mock("../utils/logger", () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    },
}));

describe("drugLookup Service - lookupDrugByBatch", () => {
    const batchNumber = "B12345";
    const mockDrug = {
        id: "drug-uuid-123",
        barcode_id: "8901148220042",
        brand_name: "Dolo 650",
        generic_name: "Paracetamol",
        manufacturer: "Micro Labs Ltd",
        batch_number: "B12345",
        manufacturing_date: "2026-01-01",
        expiry_date: "2028-01-01",
        cdsco_approval_status: "approved",
        is_counterfeit_alert: false,
        is_cdsco_verified: true,
        cdsco_match_score: 100,
        matched_cdsco_product: "Dolo 650",
        matched_cdsco_manufacturer: "Micro Labs Ltd",
        product_match_score: 100,
        manufacturer_match_score: 100,
        manufacturer_id: "mfg-id-123",
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return cached drug immediately on cache hit", async () => {
        (getCachedDrug as jest.Mock).mockImplementation((key) => {
            if (key === "B12345||Dolo 650") return Promise.resolve(mockDrug);
            return Promise.resolve(null);
        });

        const result = await lookupDrugByBatch(batchNumber, { brand_name: "Dolo 650" });

        expect(result).toEqual(mockDrug);
        expect(getCachedDrug).toHaveBeenCalledWith("B12345");
        expect(getCachedDrug).toHaveBeenCalledWith("B12345||Dolo 650");
        // Verify database was NOT queried
        expect(supabase.from).not.toHaveBeenCalled();
        expect(incrementMissCount).not.toHaveBeenCalled();
    });

    it("should query database and cache result on cache miss (successful DB hit)", async () => {
        (getCachedDrug as jest.Mock).mockResolvedValue(null);
        mockMaybeSingle.mockResolvedValue({ data: mockDrug, error: null });

        const result = await lookupDrugByBatch(batchNumber, { brand_name: "Dolo 650" });

        expect(result).toEqual(mockDrug);
        expect(getCachedDrug).toHaveBeenCalledWith("B12345");
        expect(getCachedDrug).toHaveBeenCalledWith("B12345||Dolo 650");
        expect(incrementMissCount).toHaveBeenCalled();
        expect(supabase.from).toHaveBeenCalledWith("medicines");
        expect((supabase as any).select).toHaveBeenCalled();
        expect((supabase as any).eq).toHaveBeenCalledWith("batch_number", batchNumber);
        expect((supabase as any).eq).toHaveBeenCalledWith("brand_name", "Dolo 650");
        expect((supabase as any).limit).toHaveBeenCalledWith(1);

        // Cache updates should be triggered
        expect(incrementHitCount).toHaveBeenCalledWith(mockDrug.id, mockDrug.brand_name);
        expect(setCachedDrug).toHaveBeenCalledWith("B12345||Dolo 650", mockDrug);
    });

    it("should return null and not update cache if drug is not found in database", async () => {
        (getCachedDrug as jest.Mock).mockResolvedValue(null);
        mockMaybeSingle.mockResolvedValue({ data: null, error: null });

        const result = await lookupDrugByBatch(batchNumber, { barcode_id: "8901148220042" });

        expect(result).toBeNull();
        expect(getCachedDrug).toHaveBeenCalledWith("B12345");
        expect(getCachedDrug).toHaveBeenCalledWith("B12345|8901148220042|");
        expect(incrementMissCount).toHaveBeenCalled();
        expect(supabase.from).toHaveBeenCalledWith("medicines");

        // Cache hit increment and cache set should NOT be called
        expect(incrementHitCount).not.toHaveBeenCalled();
        expect(setCachedDrug).not.toHaveBeenCalled();
    });

    it("should log error and throw if database lookup fails", async () => {
        const dbError = new Error("Database query timeout");
        (getCachedDrug as jest.Mock).mockResolvedValue(null);
        mockMaybeSingle.mockResolvedValue({ data: null, error: dbError });

        await expect(lookupDrugByBatch(batchNumber, { brand_name: "Dolo 650" })).rejects.toThrow(
            ServiceUnavailableError
        );

        expect(getCachedDrug).toHaveBeenCalledWith("B12345");
        expect(getCachedDrug).toHaveBeenCalledWith("B12345||Dolo 650");
        expect(incrementMissCount).toHaveBeenCalled();
        expect(supabase.from).toHaveBeenCalledWith("medicines");

        // Cache hit increment and cache set should NOT be called
        expect(incrementHitCount).not.toHaveBeenCalled();
        expect(setCachedDrug).not.toHaveBeenCalled();
    });

    it("should be resilient and query DB if cache check throws an error", async () => {
        const cacheError = new Error("Redis connection closed");
        (getCachedDrug as jest.Mock).mockRejectedValue(cacheError);
        mockMaybeSingle.mockResolvedValue({ data: mockDrug, error: null });

        const result = await lookupDrugByBatch(batchNumber, { brand_name: "Dolo 650" });

        expect(result).toEqual(mockDrug);
        expect(getCachedDrug).toHaveBeenCalledWith("B12345");
        expect(getCachedDrug).toHaveBeenCalledWith("B12345||Dolo 650");
        // Verify it still queried the database
        expect(supabase.from).toHaveBeenCalledWith("medicines");
        expect(incrementMissCount).toHaveBeenCalled();
        expect(incrementHitCount).toHaveBeenCalledWith(mockDrug.id, mockDrug.brand_name);
        expect(setCachedDrug).toHaveBeenCalledWith("B12345||Dolo 650", mockDrug);
    });
});
