import request from "supertest";
import app from "../src/app";

jest.mock("../src/db/client", () => {
    const mock = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(),
    };

    return { supabase: mock };
});

jest.mock("../src/utils/redis", () => ({
    redisClient: {
        isOpen: false,
        get: jest.fn(),
        set: jest.fn(),
    },
}));

import { supabase } from "../src/db/client";
import { redisClient } from "../src/utils/redis";

const medicineFixture = (overrides: { [key: string]: any } = {}) => ({
    id: "11111111-1111-1111-1111-111111111111",
    brand_name: "Dolo 650",
    generic_name: "Paracetamol",
    manufacturer: "Micro Labs Ltd",
    batch_number: "BN2024001",
    expiry_date: "2026-12-31",
    cdsco_approval_status: "approved",
    is_counterfeit_alert: false,
    is_cdsco_verified: true,
    cdsco_match_score: 98.4,
    matched_cdsco_product: "Dolo 650",
    matched_cdsco_manufacturer: "Micro Labs Ltd",
    product_match_score: 97,
    manufacturer_match_score: 100,
    ...overrides,
});

describe("POST /api/v1/scan/verify-brand", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (redisClient as any).isOpen = false;
        ((redisClient as any).get as jest.Mock).mockResolvedValue(null);
        ((supabase as any).maybeSingle as jest.Mock).mockResolvedValue({
            data: medicineFixture(),
            error: null,
        });
    });

    it("reports verified when the medicine is CDSCO verified and not flagged counterfeit", async () => {
        ((supabase as any).maybeSingle as jest.Mock).mockResolvedValue({
            data: medicineFixture({ is_cdsco_verified: true, is_counterfeit_alert: false }),
            error: null,
        });

        const res = await request(app)
            .post("/api/v1/scan/verify-brand")
            .send({ brandName: "Dolo 650" });

        expect(res.status).toBe(200);
        expect(res.body.verified).toBe(true);
        expect(res.body.medicine.brand_name).toBe("Dolo 650");
    });

    it("reports unverified when the medicine is flagged as counterfeit", async () => {
        ((supabase as any).maybeSingle as jest.Mock).mockResolvedValue({
            data: medicineFixture({ is_cdsco_verified: true, is_counterfeit_alert: true }),
            error: null,
        });

        const res = await request(app)
            .post("/api/v1/scan/verify-brand")
            .send({ brandName: "Dolo 650" });

        expect(res.status).toBe(200);
        expect(res.body.verified).toBe(false);
        expect(res.body.medicine.is_counterfeit_alert).toBe(true);
    });

    it("reports unverified when the medicine is not CDSCO verified", async () => {
        ((supabase as any).maybeSingle as jest.Mock).mockResolvedValue({
            data: medicineFixture({ is_cdsco_verified: false, is_counterfeit_alert: false }),
            error: null,
        });

        const res = await request(app)
            .post("/api/v1/scan/verify-brand")
            .send({ brandName: "Dolo 650" });

        expect(res.status).toBe(200);
        expect(res.body.verified).toBe(false);
    });

    it("stores the correctly computed verification status in the Redis cache", async () => {
        (redisClient as any).isOpen = true;
        ((redisClient as any).get as jest.Mock).mockResolvedValue(null);
        ((supabase as any).maybeSingle as jest.Mock).mockResolvedValue({
            data: medicineFixture({ is_cdsco_verified: true, is_counterfeit_alert: true }),
            error: null,
        });

        const res = await request(app)
            .post("/api/v1/scan/verify-brand")
            .send({ brandName: "Dolo 650" });

        expect(res.status).toBe(200);
        expect(res.body.verified).toBe(false);

        const setMock = (redisClient as any).set as jest.Mock;
        expect(setMock).toHaveBeenCalledWith("brand_cache:dolo 650", expect.any(String), {
            EX: 86400,
        });
        const cachedPayload = JSON.parse(setMock.mock.calls[0][1]);
        expect(cachedPayload.verified).toBe(false);
        expect(cachedPayload.medicine.is_counterfeit_alert).toBe(true);
    });

    it("returns the cached response (with correct computed status) on a cache hit", async () => {
        (redisClient as any).isOpen = true;
        ((redisClient as any).get as jest.Mock).mockResolvedValue(
            JSON.stringify({
                verified: false,
                medicine: medicineFixture({ is_cdsco_verified: true, is_counterfeit_alert: true }),
            })
        );

        const res = await request(app)
            .post("/api/v1/scan/verify-brand")
            .send({ brandName: "Dolo 650" });

        expect(res.status).toBe(200);
        expect(res.body.verified).toBe(false);
        expect((supabase as any).from).not.toHaveBeenCalled();
    });

    it("serves unverified for a medicine not found in the database", async () => {
        ((supabase as any).maybeSingle as jest.Mock)
            .mockResolvedValueOnce({ data: null, error: null })
            .mockResolvedValueOnce({ data: null, error: null });

        const res = await request(app)
            .post("/api/v1/scan/verify-brand")
            .send({ brandName: "Unknown Medicine" });

        expect(res.status).toBe(404);
        expect(res.body.verified).toBe(false);
    });

    it("escapes ILIKE wildcards (% _ \\) in the brandName before building the query", async () => {
        ((supabase as any).maybeSingle as jest.Mock)
            .mockResolvedValueOnce({ data: null, error: null })
            .mockResolvedValueOnce({ data: null, error: null });

        const res = await request(app).post("/api/v1/scan/verify-brand").send({ brandName: "%" });

        // '%' must never match every medicine — escapeIlike turns it into \% so the
        // pattern is "%\%%" (a literal % surrounded by any-match wildcards).
        expect((supabase as any).ilike).toHaveBeenCalledWith("brand_name", "%\\%%");
        expect(res.status).toBe(404);
        expect(res.body.verified).toBe(false);
    });
});
