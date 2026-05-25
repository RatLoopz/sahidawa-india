import { detectLasaConflicts } from "../src/services/lasa.service";
import { supabase } from "../src/db/client";

// Mock the Supabase client
jest.mock("../src/db/client", () => ({
    supabase: {
        rpc: jest.fn(),
    },
}));

describe("LASA Detection Service", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const mockDatabaseResponse = (matches: { name: string, match_type: string }[]) => {
        (supabase.rpc as jest.Mock).mockResolvedValue({
            data: matches,
            error: null,
        });
    };

    it("should return empty array if no medicines in DB", async () => {
        mockDatabaseResponse([]);
        const matches = await detectLasaConflicts("Losec");
        expect(matches).toEqual([]);
    });

    it("should flag sound-alike medicines (Soundex)", async () => {
        mockDatabaseResponse([{ name: "Lasix", match_type: "sound-alike" }]);
        
        const matches = await detectLasaConflicts("Losec");
        
        expect(matches.length).toBeGreaterThan(0);
        expect(matches[0]).toMatchObject({
            name: "Lasix",
            type: "sound-alike",
            score: 1.0,
        });
    });

    it("should flag look-alike medicines visually (Jaro-Winkler)", async () => {
        mockDatabaseResponse([{ name: "Hydralazine", match_type: "look-alike" }]);
        
        const matches = await detectLasaConflicts("Hydroxyzine");
        
        expect(matches.length).toBeGreaterThan(0);
        expect(matches[0]).toMatchObject({
            name: "Hydralazine",
            type: "look-alike",
        });
        // Score should be high (above 0.85 threshold)
        expect(matches[0].score).toBeGreaterThanOrEqual(0.85);
    });

    it("should not flag completely different medicines", async () => {
        mockDatabaseResponse([]);
        
        const matches = await detectLasaConflicts("Penicillin");
        
        expect(matches.length).toBe(0);
    });
});
