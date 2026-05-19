import request from "supertest";
import app from "../src/app";

// Mocks the supabase client so it doesn't depend on a live database
jest.mock("../src/db/client", () => {
    return {
        supabase: {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            ilike: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn(),
        },
    };
});

import { supabase } from "../src/db/client";

describe("POST /api/verify", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should verify a valid batch number", async () => {
        // Mock a successful lookup
        ((supabase as any).maybeSingle as jest.Mock).mockResolvedValue({
            data: {
                brand_name: "Test Brand",
                generic_name: "Test Generic",
                manufacturer: "Test Mfg",
                batch_number: "AUG625D",
                expiry_date: "2025-12-31",
                cdsco_approval_status: "Approved",
                is_counterfeit_alert: false,
            },
            error: null,
        });

        const res = await request(app).post("/api/verify").send({ batchNumber: "AUG625D" });

        expect(res.status).toBe(200);
        expect(res.body.verified).toBe(true);
        expect(res.body.medicine.batch_number).toBe("AUG625D");
    });

    it("should return 404 for an unknown batch number", async () => {
        // Mock a no-result lookup
        ((supabase as any).maybeSingle as jest.Mock).mockResolvedValue({
            data: null,
            error: null,
        });

        const res = await request(app).post("/api/verify").send({ batchNumber: "UNKNOWN123" });

        expect(res.status).toBe(404);
        expect(res.body.verified).toBe(false);
        expect(res.body.message).toBe("Medicine not found");
    });

    it("should return 400 when batchNumber field is missing", async () => {
        const res = await request(app).post("/api/verify").send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Invalid request body");
    });

    it("should return 400 when batchNumber is not a string", async () => {
        const res = await request(app).post("/api/verify").send({ batchNumber: 12345 });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Invalid request body");
    });
});
