import { detectLasaConflicts, clearLasaCache } from "./lasa.service";
import { supabase } from "../db/client";

// Mock the Supabase client
jest.mock("../db/client", () => ({
    supabase: {
        rpc: jest.fn(),
    },
}));

describe("LASA Cache and Deduplication Service", () => {
    let nowMock = 1000000;

    beforeEach(() => {
        jest.clearAllMocks();
        clearLasaCache();
        nowMock = 1000000;
        jest.spyOn(Date, "now").mockImplementation(() => nowMock);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // 1. Cache miss: calls Supabase RPC and returns results.
    it("should fetch from Supabase RPC on a cache miss and return mapped results", async () => {
        const mockData = [
            { name: "Lasix", match_type: "sound-alike" as const },
            { name: "Hydralazine", match_type: "look-alike" as const },
        ];
        (supabase.rpc as jest.Mock).mockResolvedValue({
            data: mockData,
            error: null,
        });

        const result = await detectLasaConflicts("Losec");

        expect(supabase.rpc).toHaveBeenCalledTimes(1);
        expect(supabase.rpc).toHaveBeenCalledWith("find_lasa_conflicts", {
            target_name: "Losec",
        });
        expect(result).toEqual([
            { name: "Lasix", type: "sound-alike", score: 1.0 },
            { name: "Hydralazine", type: "look-alike", score: 0.85 },
        ]);
    });

    // 2. Cache hit (within TTL): does NOT call Supabase again, returns cached result.
    it("should return cached results on a cache hit within TTL and not call Supabase again", async () => {
        const mockData = [{ name: "Lasix", match_type: "sound-alike" as const }];
        (supabase.rpc as jest.Mock).mockResolvedValue({
            data: mockData,
            error: null,
        });

        // First call - cache miss
        const result1 = await detectLasaConflicts("Losec");
        expect(supabase.rpc).toHaveBeenCalledTimes(1);

        // Move time forward by 4 minutes (less than the 5-minute TTL)
        nowMock += 4 * 60 * 1000;

        // Second call - cache hit
        const result2 = await detectLasaConflicts("Losec");
        expect(supabase.rpc).toHaveBeenCalledTimes(1); // Still 1

        expect(result1).toEqual(result2);
    });

    // 3. Cache expiry: after TTL, calls Supabase again.
    it("should call Supabase again after the cache TTL has expired", async () => {
        const mockData = [{ name: "Lasix", match_type: "sound-alike" as const }];
        (supabase.rpc as jest.Mock).mockResolvedValue({
            data: mockData,
            error: null,
        });

        // First call - cache miss
        await detectLasaConflicts("Losec");
        expect(supabase.rpc).toHaveBeenCalledTimes(1);

        // Move time forward by 6 minutes (more than the 5-minute TTL)
        nowMock += 6 * 60 * 1000;

        // Second call - cache miss due to expiration
        await detectLasaConflicts("Losec");
        expect(supabase.rpc).toHaveBeenCalledTimes(2);
    });

    // 4. In-flight deduplication: two concurrent calls for the same key only issue one Supabase RPC.
    it("should deduplicate in-flight concurrent requests for the same key", async () => {
        const mockData = [{ name: "Lasix", match_type: "sound-alike" as const }];
        let resolveRpc: (value: any) => void = () => {};
        const rpcPromise = new Promise((resolve) => {
            resolveRpc = resolve;
        });

        (supabase.rpc as jest.Mock).mockReturnValue(rpcPromise);

        // Initiate concurrent requests
        const promise1 = detectLasaConflicts("Losec");
        const promise2 = detectLasaConflicts("Losec");

        // Resolve the RPC
        resolveRpc({
            data: mockData,
            error: null,
        });

        const [res1, res2] = await Promise.all([promise1, promise2]);

        expect(supabase.rpc).toHaveBeenCalledTimes(1);
        expect(res1).toEqual([{ name: "Lasix", type: "sound-alike", score: 1.0 }]);
        expect(res2).toEqual(res1);
    });

    // 5. Cache eviction: adding items beyond MAX_CACHE_SIZE does not crash and evicts oldest.
    it("should evict the oldest cached item when cache size exceeds MAX_CACHE_SIZE", async () => {
        (supabase.rpc as jest.Mock).mockResolvedValue({
            data: [],
            error: null,
        });

        // Call detectLasaConflicts 1001 times with different names to exceed MAX_CACHE_SIZE (1000)
        // Since we insert "med_0", "med_1", ..., "med_1000", "med_0" should be the oldest and gets evicted.
        for (let i = 0; i <= 1000; i++) {
            await detectLasaConflicts(`med_${i}`);
        }

        // We expect exactly 1001 calls to supabase.rpc for the initial requests
        expect(supabase.rpc).toHaveBeenCalledTimes(1001);

        // Reset the mock call tracker to verify subsequent calls
        (supabase.rpc as jest.Mock).mockClear();

        // Calling "med_1000" (the most recently added) should hit cache (0 RPC calls)
        await detectLasaConflicts("med_1000");
        expect(supabase.rpc).toHaveBeenCalledTimes(0);

        // Calling "med_0" (the oldest, which should have been evicted) should miss cache (1 RPC call)
        await detectLasaConflicts("med_0");
        expect(supabase.rpc).toHaveBeenCalledTimes(1);
    });
});
