import { NextRequest } from "next/server";
import { GET } from "./route";

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
    rateLimit: { limit: mockLimit },
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
        const { supabase } = require("@/lib/supabase");
        blockAll();
        await GET(makeRequest("aspirin"));
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it("query with comma does not throw and reaches DB safely", async () => {
        const { supabase } = require("@/lib/supabase");
        const orMock = jest.fn().mockReturnThis();
        supabase.from.mockReturnValue({
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
        const { supabase } = require("@/lib/supabase");
        const orMock = jest.fn().mockReturnThis();
        supabase.from.mockReturnValue({
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
