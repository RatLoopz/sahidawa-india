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
import { cacheMiddleware } from "../src/middleware/cache";

// Derived from the shared middleware (rather than a hardcoded literal) so this
// stays correct if cacheMiddleware's header format ever changes.
function cacheControlFor(durationSeconds: number, staleWhileRevalidateSeconds: number): string {
    let headerValue = "";
    const fakeRes = { setHeader: (name: string, value: string) => (headerValue = value) } as never;
    cacheMiddleware(durationSeconds, staleWhileRevalidateSeconds)({} as never, fakeRes, () => {});
    return headerValue;
}

const INTERACTIONS_CACHE_CONTROL = cacheControlFor(120, 300);

const MED_A_ID = "11111111-1111-4111-8111-111111111111";
const MED_B_ID = "22222222-2222-4222-8222-222222222222";
const MED_C_ID = "33333333-3333-4333-8333-333333333333";

describe("GET /api/v1/interactions", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        dbConfig.isSupabaseOffline = false;
    });

    it("should return Cache-Control header", async () => {
        (supabase.in as jest.Mock).mockResolvedValueOnce({ data: [], error: null });
        const response = await request(app).get(`/api/v1/interactions?ids=${MED_A_ID},${MED_B_ID}`);

        expect(response.headers["cache-control"]).toContain("public");
    });

    it("returns 400 when fewer than two medicine ids are provided", async () => {
        const missingIds = await request(app).get("/api/v1/interactions");
        const singleId = await request(app).get(`/api/v1/interactions?ids=${MED_A_ID}`);

        expect(missingIds.status).toBe(400);
        expect(missingIds.body.error).toBe("Invalid medicine id list");
        expect(singleId.status).toBe(400);
        expect(singleId.body.error).toBe("Invalid medicine id list");
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it("rejects malformed, duplicate, and oversized id lists before querying Supabase", async () => {
        const malformed = await request(app).get(`/api/v1/interactions?ids=${MED_A_ID},not-a-uuid`);
        const duplicate = await request(app).get(
            `/api/v1/interactions?ids=${MED_A_ID},${MED_A_ID}`
        );
        const oversizedIds = Array.from(
            { length: 7 },
            (_, index) => `${String(index + 1).padStart(8, "0")}-0000-4000-8000-000000000000`
        ).join(",");
        const oversized = await request(app).get(`/api/v1/interactions?ids=${oversizedIds}`);

        expect(malformed.status).toBe(400);
        expect(duplicate.status).toBe(400);
        expect(oversized.status).toBe(400);
        expect(malformed.body.error).toBe("Invalid medicine id list");
        expect(duplicate.body.error).toBe("Invalid medicine id list");
        expect(oversized.body.error).toBe("Invalid medicine id list");
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it("does not reveal whether requested UUIDs exist when fewer than two medicines match", async () => {
        (supabase.in as jest.Mock).mockResolvedValueOnce({
            data: [
                {
                    id: MED_A_ID,
                    brand_name: "Crocin",
                    generic_name: "paracetamol",
                },
            ],
            error: null,
        });

        const res = await request(app).get(`/api/v1/interactions?ids=${MED_A_ID},${MED_B_ID}`);

        expect(res.status).toBe(200);
        expect(res.headers["cache-control"]).toBe(INTERACTIONS_CACHE_CONTROL);
        expect(res.body).toEqual({ interactions: [] });
        expect(supabase.from).toHaveBeenCalledTimes(1);
        expect(supabase.from).toHaveBeenCalledWith("medicines");
    });

    it("returns a safe error message when the interaction lookup fails", async () => {
        (supabase.in as jest.Mock).mockResolvedValueOnce({
            data: null,
            error: new Error("relation medicines does not exist"),
        });

        const res = await request(app).get(`/api/v1/interactions?ids=${MED_A_ID},${MED_B_ID}`);

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: "Failed to check medicine interactions" });
    });

    it("returns pair interaction warnings with High Risk, Moderate, and Safe tags", async () => {
        const selectedGenerics = ["paracetamol", "warfarin", "ibuprofen"];

        (supabase.in as jest.Mock)
            .mockResolvedValueOnce({
                data: [
                    {
                        id: MED_A_ID,
                        brand_name: "Crocin",
                        generic_name: "paracetamol",
                    },
                    {
                        id: MED_B_ID,
                        brand_name: "Warfarin",
                        generic_name: "warfarin",
                    },
                    {
                        id: MED_C_ID,
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

        const res = await request(app).get(
            `/api/v1/interactions?ids=${MED_A_ID},${MED_B_ID},${MED_C_ID}`
        );

        expect(res.status).toBe(200);
        expect(res.headers["cache-control"]).toBe(INTERACTIONS_CACHE_CONTROL);
        expect(supabase.from).toHaveBeenCalledTimes(2);
        expect(supabase.from).toHaveBeenNthCalledWith(1, "medicines");
        expect(supabase.from).toHaveBeenNthCalledWith(2, "drug_interactions");
        expect(supabase.in).toHaveBeenCalledTimes(3);
        expect(supabase.in).toHaveBeenNthCalledWith(2, "drug_a_id", selectedGenerics);
        expect(supabase.in).toHaveBeenNthCalledWith(3, "drug_b_id", selectedGenerics);
        expect(supabase.limit).not.toHaveBeenCalled();
        expect(res.body.interactions).toEqual([
            expect.objectContaining({
                medicineAId: MED_A_ID,
                medicineBId: MED_B_ID,
                drugA: "Crocin",
                drugB: "Warfarin",
                severity: "High Risk",
                description: "May increase bleeding risk.",
                precautions: "Monitor INR and bleeding symptoms.",
            }),
            expect.objectContaining({
                medicineAId: MED_A_ID,
                medicineBId: MED_C_ID,
                drugA: "Crocin",
                drugB: "Brufen",
                severity: "Safe",
            }),
            expect.objectContaining({
                medicineAId: MED_B_ID,
                medicineBId: MED_C_ID,
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

    it("rejects medicine names that exceed the 200-character limit", async () => {
        const tooLong = "A".repeat(201);
        const res = await request(app)
            .post("/api/v1/interactions/check")
            .send({ medicines: [tooLong, "Warfarin"] });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Invalid request body");
    });

    it("rejects empty medicine name strings in the POST body", async () => {
        const res = await request(app)
            .post("/api/v1/interactions/check")
            .send({ medicines: ["", "Warfarin"] });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Invalid request body");
    });

    it("rejects oversized medicine arrays in the POST body", async () => {
        const oversized = Array.from({ length: 51 }, (_, i) => `Medicine${i}`);
        const res = await request(app)
            .post("/api/v1/interactions/check")
            .send({ medicines: oversized });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Invalid request body");
    });

    it("should successfully check interactions when Supabase is online", async () => {
        // Mock name resolutions (batched in .or())
        (supabase.or as jest.Mock).mockResolvedValueOnce({
            data: [
                { brand_name: "Crocin", generic_name: "paracetamol" },
                { brand_name: "Coumadin", generic_name: "warfarin" },
            ],
            error: null,
        });

        // Mock drug interaction query
        (supabase.in as jest.Mock).mockReturnValueOnce(supabase).mockResolvedValueOnce({
            data: [
                {
                    drug_a_id: "paracetamol",
                    drug_b_id: "warfarin",
                    severity: "serious",
                    mechanism:
                        "Prolonged regular use of paracetamol may enhance the anticoagulant effect of warfarin, increasing the risk of bleeding.",
                    description: "Paracetamol may increase the blood-thinning effect of Warfarin.",
                    clinical_recommendation:
                        "Monitor INR closely if paracetamol is used regularly.",
                    source: "DrugBank",
                },
            ],
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

    it("should normalize offline brand names with dosages (e.g., Crocin 650, Dolo-650, Calpol 500mg)", async () => {
        dbConfig.isSupabaseOffline = true;

        const tests = [
            ["Crocin 650", "Coumadin"],
            ["Dolo-650", "Warfarin"],
            ["Calpol 500mg", "Warfarin"],
        ];

        for (const medicines of tests) {
            const res = await request(app).post("/api/v1/interactions/check").send({ medicines });

            expect(res.status).toBe(200);
            expect(res.body.interactions).toHaveLength(1);
            expect(res.body.interactions[0].drugA).toBe(medicines[0]);
            expect(res.body.interactions[0].drugAGeneric).toBe("paracetamol");
            expect(res.body.interactions[0].drugBGeneric).toBe("warfarin");
            expect(res.body.interactions[0].severity).toBe("serious");
        }
    });

    it("should handle error during name resolution and automatically set isSupabaseOffline", async () => {
        // Mock database failure that causes fallback (batched in .or())
        (supabase.or as jest.Mock).mockResolvedValueOnce({
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
