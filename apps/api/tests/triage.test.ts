process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key";
// Force the text-search retrieval path: with no API key, embedQuery() returns
// null so the deterministic pg_trgm fallback is exercised instead of network.
delete process.env.GEMINI_API_KEY;

(global as any).WebSocket = (global as any).WebSocket || class {};

jest.mock("../src/db/client", () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        rpc: jest.fn(),
    },
}));

jest.mock("../src/db/supabase", () => ({
    __esModule: true,
    anonSupabase: {
        rpc: jest.fn(),
        from: jest.fn(),
    },
}));

import request from "supertest";
import app from "../src/app";
import { anonSupabase } from "../src/db/supabase";
import {
    assessUrgency,
    buildMedicineMonograph,
    embedQuery,
    formatMedicineMatch,
    retrieveRelevantMedicines,
    type MedicineRow,
} from "../src/services/medicineRag.service";

const mockedSupabase = anonSupabase as jest.Mocked<typeof anonSupabase>;

const sampleRow: MedicineRow = {
    id: "med-1",
    brand_name: "Dolo 650",
    generic_name: "Paracetamol 650mg",
    manufacturer: "Micro Labs Ltd",
    composition: "Paracetamol IP 650mg",
    strength: "650mg",
    dosage_form: "Tablet",
    schedule: null,
    mrp: "30.00",
    jan_aushadhi_price: "12.50",
    similarity: 0.91,
};

beforeEach(() => {
    jest.clearAllMocks();
});

// ── Pure helpers ─────────────────────────────────────────────────────────────

describe("medicineRag pure helpers", () => {
    it("builds a readable monograph that includes brand, generic, and composition", () => {
        const monograph = buildMedicineMonograph(sampleRow);
        expect(monograph).toContain("Dolo 650");
        expect(monograph).toContain("Paracetamol 650mg");
        expect(monograph).toContain("Composition: Paracetamol IP 650mg");
    });

    it("falls back to the generic name when no brand name is present", () => {
        const monograph = buildMedicineMonograph({ ...sampleRow, brand_name: null });
        expect(monograph.startsWith("Paracetamol 650mg")).toBe(true);
    });

    it("coerces numeric string prices to numbers when formatting a match", () => {
        const match = formatMedicineMatch(sampleRow);
        expect(match.mrp).toBe(30);
        expect(match.jan_aushadhi_price).toBe(12.5);
        expect(match.similarity).toBe(0.91);
    });

    it("flags urgent-care keywords", () => {
        expect(assessUrgency("I have severe chest pain").emergency).toBe(true);
        expect(assessUrgency("mild headache and runny nose").emergency).toBe(false);
    });

    it("returns null from embedQuery when no API key is configured", async () => {
        await expect(embedQuery("fever")).resolves.toBeNull();
    });
});

// ── Tiered retrieval ─────────────────────────────────────────────────────────

describe("retrieveRelevantMedicines", () => {
    it("uses the pg_trgm RPC when embeddings are unavailable", async () => {
        (mockedSupabase.rpc as jest.Mock).mockResolvedValueOnce({
            data: [sampleRow],
            error: null,
        });

        const matches = await retrieveRelevantMedicines("paracetamol", 5);

        expect(mockedSupabase.rpc).toHaveBeenCalledWith("search_medicines_text", {
            query_text: "paracetamol",
            match_count: 5,
        });
        expect(matches).toHaveLength(1);
        expect(matches[0].generic_name).toBe("Paracetamol 650mg");
    });

    it("falls back to an ILIKE table query when the RPC is unavailable", async () => {
        (mockedSupabase.rpc as jest.Mock).mockResolvedValueOnce({
            data: null,
            error: { message: "function does not exist" },
        });

        const limit = jest.fn().mockResolvedValueOnce({ data: [sampleRow], error: null });
        const or = jest.fn().mockReturnValue({ limit });
        const select = jest.fn().mockReturnValue({ or });
        (mockedSupabase.from as jest.Mock).mockReturnValue({ select });

        const matches = await retrieveRelevantMedicines("paracetamol", 5);

        expect(mockedSupabase.from).toHaveBeenCalledWith("medicines");
        expect(matches).toHaveLength(1);
        expect(matches[0].brand_name).toBe("Dolo 650");
    });
});

// ── Routes ───────────────────────────────────────────────────────────────────

describe("POST /api/triage/medicine-query", () => {
    it("returns 400 when the query is missing", async () => {
        const response = await request(app).post("/api/triage/medicine-query").send({});
        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid medicine query");
    });

    it("returns relevant medicines and a disclaimer", async () => {
        (mockedSupabase.rpc as jest.Mock).mockResolvedValueOnce({
            data: [sampleRow],
            error: null,
        });

        const response = await request(app)
            .post("/api/triage/medicine-query")
            .send({ query: "fever medicine" });

        expect(response.status).toBe(200);
        expect(response.body.medicines).toHaveLength(1);
        expect(response.body.medicines[0].generic_name).toBe("Paracetamol 650mg");
        expect(typeof response.body.disclaimer).toBe("string");
    });
});

describe("POST /api/triage/recommend", () => {
    it("returns 400 when symptoms are missing", async () => {
        const response = await request(app)
            .post("/api/triage/recommend")
            .send({ lat: 28, lng: 77 });
        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid recommendation request");
    });

    it("returns medicines and nearby pharmacies, flagging urgency", async () => {
        (mockedSupabase.rpc as jest.Mock).mockImplementation((fn: string) => {
            if (fn === "search_medicines_text") {
                return Promise.resolve({ data: [sampleRow], error: null });
            }
            if (fn === "get_nearest_pharmacies") {
                return Promise.resolve({
                    data: [
                        {
                            name: "PMBJAK - AIIMS",
                            address: "Ansari Nagar, New Delhi",
                            district: "South Delhi",
                            state: "Delhi",
                            phone_number: "011-26588500",
                            is_verified: true,
                            lat: 28.5672,
                            lng: 77.2088,
                            distance: 2.3,
                        },
                    ],
                    error: null,
                });
            }
            return Promise.resolve({ data: null, error: { message: "unknown rpc" } });
        });

        const response = await request(app)
            .post("/api/triage/recommend")
            .send({ symptoms: "severe chest pain since morning", lat: 28.63, lng: 77.21 });

        expect(response.status).toBe(200);
        expect(response.body.emergency).toBe(true);
        expect(response.body.medicines).toHaveLength(1);
        expect(response.body.pharmacies).toHaveLength(1);
        expect(response.body.pharmacies[0].distance).toBe("2.3 km");
    });
});
