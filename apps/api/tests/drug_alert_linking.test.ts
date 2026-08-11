import { lookupDrugByBatch } from "../src/services/drugLookup.service";
import { scanRepository } from "../src/repositories/scan.repository";

jest.mock("../src/db/client", () => {
    const chain: any = {};
    chain.select = jest.fn().mockReturnValue(chain);
    chain.eq = jest.fn().mockReturnValue(chain);
    chain.or = jest.fn().mockReturnValue(chain);
    chain.ilike = jest.fn().mockReturnValue(chain);
    chain.order = jest.fn().mockReturnValue(chain);
    chain.limit = jest.fn().mockReturnValue(chain);
    chain.maybeSingle = jest.fn().mockResolvedValue({
        data: { id: "med-123", brand_name: "Test Brand", batch_number: "BATCH1" },
        error: null,
    });

    return {
        supabase: {
            from: jest.fn().mockReturnValue(chain),
            chain,
        },
    };
});

jest.mock("../src/utils/redis", () => ({
    redisClient: {
        isOpen: true,
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue("OK"),
        incr: jest.fn().mockResolvedValue(1),
        zIncrBy: jest.fn().mockResolvedValue(1),
        expire: jest.fn().mockResolvedValue(true),
    },
    connectRedis: jest.fn(),
}));

import { supabase } from "../src/db/client";

describe("Deterministic Medicine Lookups", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("lookupDrugByBatch applies explicit created_at DESC and id ASC ordering before limit(1)", async () => {
        const result = await lookupDrugByBatch("BATCH1", { brand_name: "Test Brand" });
        expect(result).toBeDefined();

        const chain = (supabase as any).chain;
        expect(chain.order).toHaveBeenCalledWith("created_at", { ascending: false });
        expect(chain.order).toHaveBeenCalledWith("id", { ascending: true });
        expect(chain.limit).toHaveBeenCalledWith(1);
    });

    it("scanRepository.findMedicineByMatchedName applies explicit ordering", async () => {
        await scanRepository.findMedicineByMatchedName("Test Brand");
        const chain = (supabase as any).chain;
        expect(chain.order).toHaveBeenCalledWith("created_at", { ascending: false });
        expect(chain.order).toHaveBeenCalledWith("id", { ascending: true });
        expect(chain.limit).toHaveBeenCalledWith(1);
    });

    it("scanRepository.findMedicineByBrandName applies explicit ordering", async () => {
        await scanRepository.findMedicineByBrandName("Test Brand");
        const chain = (supabase as any).chain;
        expect(chain.order).toHaveBeenCalledWith("created_at", { ascending: false });
        expect(chain.order).toHaveBeenCalledWith("id", { ascending: true });
        expect(chain.limit).toHaveBeenCalledWith(1);
    });
});
