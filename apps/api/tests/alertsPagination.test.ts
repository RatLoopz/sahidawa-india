import request from "supertest";
import app from "../src/app";

// jest.mock is hoisted — everything must be self-contained inside the factory
jest.mock("../src/db/client", () => {
    const chain: any = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn(),
        eq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
    };
    // Thenable for fire-and-forget updates
    chain.then = function (this: any, callback: Function) {
        return Promise.resolve(callback({ data: null, error: null }));
    };

    return {
        supabase: {
            from: jest.fn().mockReturnValue(chain),
        },
    };
});

// Mock doubleCsrf to automatically bypass CSRF validation during testing
jest.mock("csrf-csrf", () => ({
    doubleCsrf: () => ({
        doubleCsrfProtection: (req: any, res: any, next: any) => next(),
        generateToken: () => "mocked-csrf-token",
    }),
}));

import { supabase } from "../src/db/client";

// ── Helpers ────────────────────────────────────────────────────────

function buildAlerts(n: number) {
    return Array.from({ length: n }, (_, i) => ({
        id: `alert-${i + 1}`,
        title: `Alert ${i + 1}`,
        created_at: new Date().toISOString(),
    }));
}

/** Returns the shared chain object returned by supabase.from() */
function getChain() {
    return supabase.from() as any;
}

function mockSupabase(alerts: object[], totalCount: number, error: object | null = null) {
    getChain().range.mockResolvedValue({
        data: error ? null : alerts,
        error,
        count: error ? null : totalCount,
    });
}

function mockApiKeyValid() {
    getChain().maybeSingle.mockResolvedValue({
        data: { id: "key-1", caller_name: "ML Agent", scopes: ["alerts:ingest"], is_active: true },
        error: null,
    });
}

function mockApiKeyInvalid() {
    getChain().maybeSingle.mockResolvedValue({
        data: null,
        error: null,
    });
}

function mockApiKeyError() {
    getChain().maybeSingle.mockResolvedValue({
        data: null,
        error: { message: "DB error" },
    });
}

// ── Test Suite ────────────────────────────────────────────────────

describe("GET /api/v1/alerts — pagination", () => {
    beforeEach(() => jest.clearAllMocks());

    it("returns the correct pagination schema on a populated page", async () => {
        mockSupabase(buildAlerts(10), 35);

        const res = await request(app).get("/api/v1/alerts?page=1&limit=10");

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            pageIndex: 1,
            pageSize: 10,
            totalCount: 35,
            totalPageCount: 4,
        });
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data).toHaveLength(10);
    });

    it("returns correct pageIndex when requesting page 2", async () => {
        mockSupabase(buildAlerts(10), 35);

        const res = await request(app).get("/api/v1/alerts?page=2&limit=10");

        expect(res.status).toBe(200);
        expect(res.body.pageIndex).toBe(2);
    });

    it("returns correct pageIndex when requesting the last page", async () => {
        mockSupabase(buildAlerts(5), 35);

        const res = await request(app).get("/api/v1/alerts?page=4&limit=10");

        expect(res.status).toBe(200);
        expect(res.body.pageIndex).toBe(4);
        expect(res.body.pageSize).toBe(5);
        expect(res.body.totalPageCount).toBe(4);
    });

    it("returns empty data array when page exceeds totalPageCount", async () => {
        mockSupabase([], 35);

        const res = await request(app).get("/api/v1/alerts?page=99&limit=10");

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);
        expect(res.body.pageSize).toBe(0);
        expect(res.body.totalCount).toBe(35);
        expect(res.body.totalPageCount).toBe(4);
    });

    it("returns empty data and zero counts when table has no alerts", async () => {
        mockSupabase([], 0);

        const res = await request(app).get("/api/v1/alerts?page=1&limit=10");

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);
        expect(res.body.pageSize).toBe(0);
        expect(res.body.totalCount).toBe(0);
        expect(res.body.totalPageCount).toBe(0);
    });

    it("respects a custom limit of 5", async () => {
        mockSupabase(buildAlerts(5), 20);

        const res = await request(app).get("/api/v1/alerts?page=1&limit=5");

        expect(res.status).toBe(200);
        expect(res.body.pageSize).toBe(5);
        expect(res.body.totalPageCount).toBe(4);
    });

    it("respects a custom limit of 25", async () => {
        mockSupabase(buildAlerts(25), 60);

        const res = await request(app).get("/api/v1/alerts?page=1&limit=25");

        expect(res.status).toBe(200);
        expect(res.body.pageSize).toBe(25);
        expect(res.body.totalPageCount).toBe(3);
    });

    it("defaults to page=1 and limit=10 when no query params given", async () => {
        mockSupabase(buildAlerts(10), 50);

        const res = await request(app).get("/api/v1/alerts");

        expect(res.status).toBe(200);
        expect(res.body.pageIndex).toBe(1);
        expect(res.body.pageSize).toBe(10);
        expect(res.body.totalPageCount).toBe(5);
    });

    it("falls back to page=1 when page param is invalid (string)", async () => {
        mockSupabase(buildAlerts(10), 30);

        const res = await request(app).get("/api/v1/alerts?page=abc&limit=10");

        expect(res.status).toBe(200);
        expect(res.body.pageIndex).toBe(1);
    });

    it("falls back to page=1 when page param is zero", async () => {
        mockSupabase(buildAlerts(10), 30);

        const res = await request(app).get("/api/v1/alerts?page=0&limit=10");

        expect(res.status).toBe(200);
        expect(res.body.pageIndex).toBe(1);
    });

    it("caps limit at 100 when limit param exceeds maximum", async () => {
        mockSupabase(buildAlerts(100), 500);

        const res = await request(app).get("/api/v1/alerts?page=1&limit=999");

        expect(res.status).toBe(200);
        expect(res.body.totalPageCount).toBe(5);
    });

    it("returns 500 when the database returns an error", async () => {
        mockSupabase([], 0, { message: "DB connection failed" });

        const res = await request(app).get("/api/v1/alerts?page=1&limit=10");

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty("error");
    });
});

describe("POST /api/v1/alerts/ingest — API key authentication", () => {
    beforeEach(() => jest.clearAllMocks());

    it("returns 401 when x-api-secret header is missing", async () => {
        const res = await request(app).post("/api/v1/alerts/ingest").send({ alerts: [] });

        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/missing.*api.*key/i);
    });

    it("returns 401 when API key is invalid", async () => {
        mockApiKeyInvalid();

        const res = await request(app)
            .post("/api/v1/alerts/ingest")
            .set("x-api-secret", "invalid-key")
            .send({ alerts: [] });

        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/invalid|inactive/i);
    });

    it("returns 500 when the database lookup fails", async () => {
        mockApiKeyError();

        const res = await request(app)
            .post("/api/v1/alerts/ingest")
            .set("x-api-secret", "some-key")
            .send({ alerts: [] });

        expect(res.status).toBe(500);
    });

    it("returns 400 when payload is invalid", async () => {
        mockApiKeyValid();

        const res = await request(app)
            .post("/api/v1/alerts/ingest")
            .set("x-api-secret", "valid-key")
            .send({ alerts: "not-an-array" });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/invalid/i);
    });
});
