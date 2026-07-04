import { NextRequest } from "next/server";
import { GET } from "./route";
import { supabase } from "@/lib/supabase";
import { redis } from "@/lib/redis";

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/lib/supabase", () => ({
    supabase: {
        from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnThis(),
            or: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
    },
}));

jest.mock("@/lib/redis", () => ({
    redis: {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue("OK"),
    },
}));

const mockLimit = jest.fn();
jest.mock("@/lib/rateLimit", () => ({
    rateLimit: { limit: (...args: unknown[]) => mockLimit(...args) },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(q: string): NextRequest {
    return new NextRequest(`http://localhost/api/medicines/search?q=${encodeURIComponent(q)}`, {
        headers: { "x-forwarded-for": "127.0.0.1" },
    });
}

function allowAll() {
    mockLimit.mockResolvedValue({
        success: true,
        limit: 30,
        remaining: 29,
        reset: Date.now() + 60000,
    });
}

function blockAll() {
    mockLimit.mockResolvedValue({
        success: false,
        limit: 30,
        remaining: 0,
        reset: Date.now() + 60000,
    });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/medicines/search", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        allowAll();
    });

    it("returns empty array for query shorter than 2 chars", async () => {
        const res = await GET(makeRequest("a"));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual([]);
    });

    it("returns empty array for whitespace-only query", async () => {
        const res = await GET(makeRequest("   "));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual([]);
    });

    it("returns empty array for empty query", async () => {
        const res = await GET(makeRequest(""));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual([]);
    });

    it("returns 400 for query longer than 100 characters", async () => {
        const res = await GET(makeRequest("a".repeat(101)));
        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toEqual({
            error: "Search query must be 100 characters or fewer.",
        });
    });

    it("does not reach Redis or DB for query longer than 100 characters", async () => {
        const res = await GET(makeRequest("a".repeat(101)));

        expect(res.status).toBe(400);
        expect(redis.get).not.toHaveBeenCalled();
        expect(redis.set).not.toHaveBeenCalled();
        expect(supabase.from as jest.Mock).not.toHaveBeenCalled();
    });

    it("returns 429 when rate limit exceeded", async () => {
        blockAll();
        const res = await GET(makeRequest("aspirin"));
        expect(res.status).toBe(429);
        const body = await res.json();
        expect(body.error).toMatch(/too many requests/i);
    });

    it("rate limit check includes Retry-After header on 429", async () => {
        blockAll();
        const res = await GET(makeRequest("aspirin"));
        expect(res.headers.get("Retry-After")).not.toBeNull();
    });

    it("does not reach DB when rate limited", async () => {
        blockAll();
        await GET(makeRequest("aspirin"));
        expect(supabase.from as jest.Mock).not.toHaveBeenCalled();
    });

    it("query with comma does not throw and reaches DB safely", async () => {
        const orMock = jest.fn().mockReturnThis();
        (supabase.from as jest.Mock).mockReturnValue({
            select: jest.fn().mockReturnThis(),
            or: orMock,
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        });

        const res = await GET(makeRequest("aspirin, 500mg"));
        expect(res.status).toBe(200);

        // Confirm commas in the raw query are escaped in the .or() call
        const orArg: string = orMock.mock.calls[0][0];
        expect(orArg).not.toMatch(/ilike\."%aspirin, 500mg%"/);
    });

    it("query with parentheses is escaped before reaching DB", async () => {
        const orMock = jest.fn().mockReturnThis();
        (supabase.from as jest.Mock).mockReturnValue({
            select: jest.fn().mockReturnThis(),
            or: orMock,
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        });

        const res = await GET(makeRequest("(test)"));
        expect(res.status).toBe(200);

        const orArg: string = orMock.mock.calls[0][0];
        expect(orArg).not.toMatch(/ilike\."%\(test\)%"/);
    });
});
