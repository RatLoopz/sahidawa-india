import request from "supertest";
import app from "../src/app";

// Mock the db/client module
jest.mock("../src/db/client", () => {
    const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
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

describe("GET /api/v1/interactions", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        dbConfig.isSupabaseOffline = false;
    });

    it("returns 400 when fewer than two medicine ids are provided", async () => {
        const missingIds = await request(app).get("/api/v1/interactions");
        const singleId = await request(app).get("/api/v1/interactions?ids=med-1");

        expect(missingIds.status).toBe(400);
        expect(missingIds.body.error).toBe("At least two medicine ids are required");
        expect(singleId.status).toBe(400);
        expect(singleId.body.error).toBe("At least two medicine ids are required");
    });

    it("returns pair interaction warnings with High Risk, Moderate, and Safe tags", async () => {
        const selectedGenerics = ["paracetamol", "warfarin", "ibuprofen"];

        (supabase.in as jest.Mock)
            .mockResolvedValueOnce({
                data: [
                    {
                        id: "med-a",
                        brand_name: "Crocin",
                        generic_name: "paracetamol",
                    },
                    {
                        id: "med-b",
                        brand_name: "Warfarin",
                        generic_name: "warfarin",
                    },
                    {
                        id: "med-c",
                        brand_name: "Brufen",
                        generic_name: "ibuprofen",
                    },
                ],
                error: null,
            })
            .mockReturnValueOnce(supabase)
            .mockResolvedValueOnce({
                data: [
                    {
                        drug_a_id: "paracetamol",
                        drug_b_id: "warfarin",
                        severity: "serious",
                        description: "May increase bleeding risk.",
                        clinical_recommendation: "Monitor INR and bleeding symptoms.",
                        mechanism: "Enhanced anticoagulant effect.",
                        source: "DrugBank",
                    },
                    {
                        drug_a_id: "warfarin",
                        drug_b_id: "ibuprofen",
                        severity: "moderate",
                        description: "May increase stomach bleeding risk.",
                        clinical_recommendation: "Use only with clinician guidance.",
                        mechanism: "Additive gastrointestinal toxicity.",
                        source: "NLM RxNav",
                    },
                ],
                error: null,
            });

        const res = await request(app).get("/api/v1/interactions?ids=med-a,med-b,med-c");

        expect(res.status).toBe(200);
        expect(supabase.from).toHaveBeenCalledTimes(2);
        expect(supabase.from).toHaveBeenNthCalledWith(1, "medicines");
        expect(supabase.from).toHaveBeenNthCalledWith(2, "drug_interactions");
        expect(supabase.in).toHaveBeenCalledTimes(3);
        expect(supabase.in).toHaveBeenNthCalledWith(2, "drug_a_id", selectedGenerics);
        expect(supabase.in).toHaveBeenNthCalledWith(3, "drug_b_id", selectedGenerics);
        expect(supabase.limit).not.toHaveBeenCalled();
        expect(res.body.interactions).toEqual([
            expect.objectContaining({
                medicineAId: "med-a",
                medicineBId: "med-b",
                drugA: "Crocin",
                drugB: "Warfarin",
                severity: "High Risk",
                description: "May increase bleeding risk.",
                precautions: "Monitor INR and bleeding symptoms.",
            }),
            expect.objectContaining({
                medicineAId: "med-a",
                medicineBId: "med-c",
                drugA: "Crocin",
                drugB: "Brufen",
                severity: "Safe",
            }),
            expect.objectContaining({
                medicineAId: "med-b",
                medicineBId: "med-c",
                drugA: "Warfarin",
                drugB: "Brufen",
                severity: "Moderate",
                sideEffects: "May increase stomach bleeding risk.",
            }),
        ]);
    });
});

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
