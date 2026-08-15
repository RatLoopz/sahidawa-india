import request from "supertest";
import express from "express";

// Mock the supabase client so the route does not depend on a live database.
// Each chained method returns the client (mockReturnThis) so the terminal
// .maybeSingle() call can be queued per-test.
jest.mock("../../src/db/client", () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(),
        rpc: jest.fn(),
    },
}));

// Mock Redis: isOpen + a controllable `get` (cache contents) and a no-op `set`.
jest.mock("../../src/utils/redis", () => ({
    redisClient: {
        isOpen: true,
        get: jest.fn(),
        set: jest.fn().mockResolvedValue("OK"),
        del: jest.fn().mockResolvedValue(1),
        connect: jest.fn().mockResolvedValue(true),
        on: jest.fn(),
        scanIterator: jest.fn(),
    },
    connectRedis: jest.fn(),
}));

// Pass-through rate limiter so the route handler runs directly.
jest.mock("../../src/middleware/rateLimit", () => {
    const mockStore = {
        increment: jest.fn().mockResolvedValue({ totalHits: 1, resetTime: Date.now() + 60000 }),
        decrement: jest.fn().mockResolvedValue(undefined),
        resetKey: jest.fn().mockResolvedValue(undefined),
        resetAll: jest.fn().mockResolvedValue(undefined),
    };
    const passThrough = (_req: any, _res: any, next: any) => next();
    return {
        buildStore: jest.fn(() => mockStore),
        scanQueryLimiter: passThrough,
        verifyLimiter: passThrough,
        uploadRateLimiter: passThrough,
        limiter: passThrough,
        batchLimiter: passThrough,
        reportLimiter: passThrough,
        lasaLimiter: passThrough,
        compareLimiter: passThrough,
        interactionCheckLimiter: passThrough,
        interactionIdsLimiter: passThrough,
        eligibilityLimiter: passThrough,
        triageLimiter: passThrough,
        analyticsLimiter: passThrough,
        authLimiter: passThrough,
        authTargetLimiter: passThrough,
        notificationRegisterLimiter: passThrough,
        trackingLimiter: passThrough,
        webhookLimiter: passThrough,
    };
});

jest.mock("../../src/utils/logger", () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

import { supabase } from "../../src/db/client";
import { redisClient } from "../../src/utils/redis";
import scanRouter from "../../src/routes/scan";

const app = express();
app.use(express.json());
app.use("/api/v1/scan", scanRouter);

/**
 * Regression tests for issue #4146: /api/v1/scan/verify-brand must not serve a
 * stale safety verdict from its 24h brand cache. Safety-critical fields
 * (is_counterfeit_alert, is_cdsco_verified, CDSCO status) are overlaid live on
 * every response — whether the medicine came from the Redis cache or a fresh DB
 * lookup — and the `verified` verdict is recomputed from the overlaid fields.
 */
describe("POST /api/v1/scan/verify-brand — live safety overlay (#4146)", () => {
    const safeMedicine = {
        id: "med-1",
        brand_name: "Dolo 650",
        generic_name: "Paracetamol",
        manufacturer: "Micro Labs",
        batch_number: "BN1",
        expiry_date: "2027-01-01",
        cdsco_approval_status: "approved",
        is_counterfeit_alert: false,
        is_cdsco_verified: true,
        cdsco_match_score: 100,
        matched_cdsco_product: "Dolo 650",
        matched_cdsco_manufacturer: "Micro Labs",
        product_match_score: 100,
        manufacturer_match_score: 100,
    };

    const counterfeitOverlay = {
        cdsco_approval_status: "recalled",
        is_counterfeit_alert: true,
        is_cdsco_verified: true,
        cdsco_match_score: 100,
        matched_cdsco_product: "Dolo 650",
        matched_cdsco_manufacturer: "Micro Labs",
        product_match_score: 100,
        manufacturer_match_score: 100,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (redisClient as any).isOpen = true;
    });

    it("recomputes verified=false when a cached 'safe' medicine is now counterfeit (cache HIT)", async () => {
        // Cache holds a 24h-old snapshot that says the medicine is safe.
        (redisClient.get as jest.Mock).mockResolvedValueOnce(
            JSON.stringify({ verified: true, medicine: { ...safeMedicine } })
        );

        // refreshLiveSafety reads the live row, which now flags a counterfeit alert.
        const maybeSingle = (supabase.from as jest.Mock)().maybeSingle as jest.Mock;
        maybeSingle.mockResolvedValueOnce({ data: counterfeitOverlay, error: null });

        const res = await request(app)
            .post("/api/v1/scan/verify-brand")
            .send({ brandName: "Dolo 650" });

        expect(res.status).toBe(200);
        // The cached value said verified: true, but the live overlay must win.
        expect(res.body.verified).toBe(false);
        expect(res.body.medicine.is_counterfeit_alert).toBe(true);
        expect(res.body.medicine.cdsco_approval_status).toBe("recalled");
    });

    it("recomputes verified=false on a fresh DB lookup when the live row is counterfeit", async () => {
        (redisClient.get as jest.Mock).mockResolvedValueOnce(null); // cache miss

        const maybeSingle = (supabase.from as jest.Mock)().maybeSingle as jest.Mock;
        // 1st maybeSingle: brand_name lookup returns the stored (safe) row.
        maybeSingle.mockResolvedValueOnce({ data: { ...safeMedicine }, error: null });
        // 2nd maybeSingle: refreshLiveSafety overlays the live counterfeit flags.
        maybeSingle.mockResolvedValueOnce({ data: counterfeitOverlay, error: null });

        const res = await request(app)
            .post("/api/v1/scan/verify-brand")
            .send({ brandName: "Dolo 650" });

        expect(res.status).toBe(200);
        expect(res.body.verified).toBe(false);
        expect(res.body.medicine.is_counterfeit_alert).toBe(true);
    });

    it("still returns verified=true for a genuinely safe medicine on cache HIT", async () => {
        (redisClient.get as jest.Mock).mockResolvedValueOnce(
            JSON.stringify({ verified: true, medicine: { ...safeMedicine } })
        );

        const maybeSingle = (supabase.from as jest.Mock)().maybeSingle as jest.Mock;
        // Live overlay confirms it is still safe.
        maybeSingle.mockResolvedValueOnce({
            data: { is_counterfeit_alert: false, is_cdsco_verified: true },
            error: null,
        });

        const res = await request(app)
            .post("/api/v1/scan/verify-brand")
            .send({ brandName: "Dolo 650" });

        expect(res.status).toBe(200);
        expect(res.body.verified).toBe(true);
    });

    it("falls back to cached safety fields when the live overlay read fails", async () => {
        (redisClient.get as jest.Mock).mockResolvedValueOnce(
            JSON.stringify({ verified: true, medicine: { ...safeMedicine } })
        );

        const maybeSingle = (supabase.from as jest.Mock)().maybeSingle as jest.Mock;
        // Live read errors — route must degrade gracefully (keep cached safe verdict).
        maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "boom" } });

        const res = await request(app)
            .post("/api/v1/scan/verify-brand")
            .send({ brandName: "Dolo 650" });

        expect(res.status).toBe(200);
        expect(res.body.verified).toBe(true);
    });
});
