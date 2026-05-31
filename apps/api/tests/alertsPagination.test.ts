import request from "supertest";
import app from "../src/app";

// jest.mock is hoisted before variable declarations so we define
// the mock function inside the factory to avoid initialization errors.
jest.mock("../src/db/client", () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn(),
    },
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

function mockSupabase(alerts: object[], totalCount: number, error: object | null = null) {
    // Cast to any to bypass TypeScript's supabase type — the real client is mocked
    const mockedSupabase = supabase as any;
    mockedSupabase.range.mockResolvedValue({
        data: error ? null : alerts,
        error,
        count: error ? null : totalCount,
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