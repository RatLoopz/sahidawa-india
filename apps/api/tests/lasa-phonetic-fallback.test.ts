import { detectLasaConflicts, clearLasaCache } from "../src/services/lasa.service";

jest.mock("../src/db/client", () => ({
    supabase: {
        rpc: jest.fn(),
        from: jest.fn(),
    },
}));

import { supabase } from "../src/db/client";

describe("detectLasaConflicts - phonetic fallback", () => {
    beforeEach(() => {
        clearLasaCache();
        jest.clearAllMocks();
    });

    it("falls back to local phonetic matching when RPC errors", async () => {
        (supabase.rpc as jest.Mock).mockResolvedValue({
            data: null,
            error: { message: "connection pool exhausted" },
        });

        (supabase.from as jest.Mock).mockReturnValue({
            select: jest.fn().mockResolvedValue({
                data: [
                    { brand_name: "Dopamine", generic_name: null },
                    { brand_name: "Ibuprofen", generic_name: null },
                ],
                error: null,
            }),
        });

        const result = await detectLasaConflicts("Dopamin");

        expect(result.length).toBeGreaterThan(0);
        expect(result.some((m) => m.name === "Dopamine")).toBe(true);
    });

    it("falls back when RPC returns zero results", async () => {
        (supabase.rpc as jest.Mock).mockResolvedValue({ data: [], error: null });

        (supabase.from as jest.Mock).mockReturnValue({
            select: jest.fn().mockResolvedValue({
                data: [{ brand_name: "Dopamine", generic_name: null }],
                error: null,
            }),
        });

        const result = await detectLasaConflicts("Dopamin");

        expect(result.some((m) => m.name === "Dopamine")).toBe(true);
    });

    it("does not use fallback when RPC succeeds with results", async () => {
        (supabase.rpc as jest.Mock).mockResolvedValue({
            data: [{ name: "Dopamine", match_type: "sound-alike" }],
            error: null,
        });

        const fromSpy = supabase.from as jest.Mock;

        const result = await detectLasaConflicts("Dopamin");

        expect(result).toEqual([{ name: "Dopamine", type: "sound-alike", score: 1.0 }]);
        expect(fromSpy).not.toHaveBeenCalled();
    });

    it("returns empty array for empty input without querying anything", async () => {
        const result = await detectLasaConflicts("   ");
        expect(result).toEqual([]);
        expect(supabase.rpc).not.toHaveBeenCalled();
    });
});
