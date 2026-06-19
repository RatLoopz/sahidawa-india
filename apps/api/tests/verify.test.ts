import request from "supertest";
import app from "../src/app";

jest.mock("../src/db/client", () => {
    const mock = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
    };

    return { supabase: mock };
});

import { supabase } from "../src/db/client";

describe("POST /api/verify", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should verify a valid batch number", async () => {
        // Mock scan history counts and insert
        ((supabase as any).gte as jest.Mock)
            .mockResolvedValueOnce({ count: 0, error: null })
            .mockResolvedValueOnce({ count: 0, error: null });
        ((supabase as any).insert as jest.Mock).mockResolvedValue({ data: null, error: null });

        // Mock a successful lookup
        ((supabase as any).maybeSingle as jest.Mock).mockResolvedValue({
            data: {
                id: "11111111-1111-1111-1111-111111111111",
                barcode_id: "1234567890123",
                brand_name: "Test Brand",
                generic_name: "Test Generic",
                manufacturer: "Test Mfg",
                batch_number: "AUG625D",
                expiry_date: "2025-12-31",
                cdsco_approval_status: "Approved",
                is_counterfeit_alert: false,
                is_cdsco_verified: true,
                cdsco_match_score: 98.4,
                matched_cdsco_product: "Test Brand",
                matched_cdsco_manufacturer: "Test Mfg",
                product_match_score: 97,
                manufacturer_match_score: 100,
            },
            error: null,
        });

        const res = await request(app).post("/api/verify").send({ batchNumber: "AUG625D" });

        expect(res.status).toBe(200);
        expect(res.body.verified).toBe(true);
        expect(res.body.medicine.batch_number).toBe("AUG625D");
        expect(res.body.medicine.is_cdsco_verified).toBe(true);
        expect(res.body.medicine.cdsco_match_score).toBe(98.4);
        expect(res.body.scanMeta).toBeDefined();
        expect(res.body.scanMeta.recentScanCount24h).toBe(1);
        expect(res.body.scanMeta.suspicious).toBe(false);
    });

    it("should flag suspicious duplicate scan volume", async () => {
        ((supabase as any).gte as jest.Mock)
            .mockResolvedValueOnce({ count: 2, error: null })
            .mockResolvedValueOnce({ count: 5, error: null });
        ((supabase as any).insert as jest.Mock).mockResolvedValue({ data: null, error: null });
        ((supabase as any).maybeSingle as jest.Mock).mockResolvedValueOnce({
            data: {
                id: "11111111-1111-1111-1111-111111111111",
                barcode_id: "1234567890123",
                brand_name: "Test Brand",
                generic_name: "Test Generic",
                manufacturer: "Test Mfg",
                batch_number: "AUG625D",
                expiry_date: "2025-12-31",
                cdsco_approval_status: "Approved",
                is_counterfeit_alert: false,
                is_cdsco_verified: false,
                cdsco_match_score: 42.1,
                matched_cdsco_product: null,
                matched_cdsco_manufacturer: null,
                product_match_score: 44,
                manufacturer_match_score: 38,
            },
            error: null,
        });

        const res = await request(app).post("/api/verify").send({ batchNumber: "AUG625D" });

        expect(res.status).toBe(200);
        expect(res.body.scanMeta).toBeDefined();
        expect(res.body.scanMeta.recentScanCount24h).toBe(3);
        expect(res.body.scanMeta.suspicious).toBe(true);
        expect(res.body.scanMeta.suspicionReasons.length).toBeGreaterThan(0);
        expect(res.body.medicine.is_cdsco_verified).toBe(false);
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
