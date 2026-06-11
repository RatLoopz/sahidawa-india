import request from "supertest";
import app from "../src/app";

// Mock the db/client module
jest.mock("../src/db/client", () => {
    const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(),
    };
    const mockDbConfig = {
        isSupabaseOffline: false,
    };
    return {
        supabase: mockSupabase,
        dbConfig: mockDbConfig,
    };
});

import { supabase, dbConfig } from "../src/db/client";

describe("POST /api/v1/interactions/check", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        dbConfig.isSupabaseOffline = false;
    });

    it("should return 400 if less than two medicines are provided", async () => {
        const res = await request(app)
            .post("/api/v1/interactions/check")
            .send({ medicines: ["Paracetamol"] });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Invalid request body");
    });

    it("should successfully check interactions when Supabase is online", async () => {
        const mockMaybeSingle = supabase.maybeSingle as jest.Mock;

        // Mock name resolutions
        mockMaybeSingle
            .mockResolvedValueOnce({
                data: { brand_name: "Crocin", generic_name: "paracetamol" },
                error: null,
            })
            .mockResolvedValueOnce({
                data: { brand_name: "Coumadin", generic_name: "warfarin" },
                error: null,
            });

        // Mock drug interaction query
        mockMaybeSingle.mockResolvedValueOnce({
            data: {
                drug_a_id: "paracetamol",
                drug_b_id: "warfarin",
                severity: "serious",
                mechanism:
                    "Prolonged regular use of paracetamol may enhance the anticoagulant effect of warfarin, increasing the risk of bleeding.",
                description: "Paracetamol may increase the blood-thinning effect of Warfarin.",
                clinical_recommendation: "Monitor INR closely if paracetamol is used regularly.",
                source: "DrugBank",
            },
            error: null,
        });

        const res = await request(app)
            .post("/api/v1/interactions/check")
            .send({ medicines: ["Crocin", "Coumadin"] });

        expect(res.status).toBe(200);
        expect(res.body.interactions).toHaveLength(1);
        expect(res.body.interactions[0].drugA).toBe("Crocin");
        expect(res.body.interactions[0].drugAGeneric).toBe("paracetamol");
        expect(res.body.interactions[0].drugB).toBe("Coumadin");
        expect(res.body.interactions[0].drugBGeneric).toBe("warfarin");
        expect(res.body.interactions[0].severity).toBe("serious");
    });

    it("should fallback to local static interactions when Supabase is offline", async () => {
        dbConfig.isSupabaseOffline = true;

        const res = await request(app)
            .post("/api/v1/interactions/check")
            .send({ medicines: ["crocin", "coumadin"] });

        expect(res.status).toBe(200);
        expect(res.body.interactions).toHaveLength(1);
        expect(res.body.interactions[0].drugAGeneric).toBe("paracetamol");
        expect(res.body.interactions[0].drugBGeneric).toBe("warfarin");
        expect(res.body.interactions[0].severity).toBe("serious");
    });

    it("should handle error during name resolution and automatically set isSupabaseOffline", async () => {
        const mockMaybeSingle = supabase.maybeSingle as jest.Mock;

        // Mock database failure that causes fallback
        mockMaybeSingle.mockResolvedValueOnce({
            data: null,
            error: new Error("fetch failed"),
        });

        const res = await request(app)
            .post("/api/v1/interactions/check")
            .send({ medicines: ["crocin", "coumadin"] });

        expect(res.status).toBe(200);
        expect(dbConfig.isSupabaseOffline).toBe(true);
        expect(res.body.interactions).toHaveLength(1);
        expect(res.body.interactions[0].drugAGeneric).toBe("paracetamol");
        expect(res.body.interactions[0].drugBGeneric).toBe("warfarin");
        expect(res.body.interactions[0].severity).toBe("serious");
    });
});
