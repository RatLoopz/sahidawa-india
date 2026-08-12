import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const mockLimit = jest.fn<(key: string) => Promise<RateLimitResult>>();

type RateLimitResult = {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
};

jest.mock("@/lib/rateLimit", () => ({
    rateLimit: { limit: (...args: unknown[]) => mockLimit(args[0] as string) },
}));

const mockGet = jest.fn<() => Promise<string | null>>();
const mockSet = jest.fn();

jest.mock("@/lib/redis", () => ({
    redis: {
        get: (...args: unknown[]) => mockGet(),
        set: (...args: unknown[]) => mockSet(args[0], args[1], args[2]),
    },
}));

const mockFrom = jest.fn();

jest.mock("@/lib/supabase", () => ({
    supabase: {
        from: (table: string) => mockFrom(table),
    },
}));

import { NextRequest } from "next/server";
import { GET } from "../app/api/medicines/search/route";

function allowAll() {
    mockLimit.mockResolvedValue({
        success: true,
        limit: 30,
        remaining: 29,
        reset: Date.now() + 60000,
    });
}

function makeRequest(q: string, headers: Record<string, string> = {}): NextRequest {
    return new NextRequest(`http://localhost/api/medicines/search?q=${encodeURIComponent(q)}`, {
        headers: { "x-forwarded-for": "127.0.0.1", ...headers },
    });
}

function arrangeDbRows() {
    mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    });
}

describe("GET /api/medicines/search — regression guard for Issue #4201", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        allowAll();
        arrangeDbRows();
    });

    it("uses the hardened getClientIp (defaults to loopback) so forged X-Forwarded-For cannot create fresh rate-limit buckets", async () => {
        // Without TRUST_PROXY_HEADERS the hardened helper must ignore
        // attacker-controlled forwarding headers entirely and rate-limit on
        // 127.0.0.1. The naive inline reimplementation (Issue #4201) read the
        // leftmost hop instead, giving a fresh bucket per request.
        const res = await GET(
            new NextRequest("http://localhost/api/medicines/search?q=aspirin&token=1", {
                headers: {
                    "x-forwarded-for": "203.0.113.99, 198.51.100.7",
                    "x-real-ip": "198.51.100.7",
                },
            })
        );

        expect(res.status).toBe(200);
        expect(mockLimit).toHaveBeenCalledTimes(1);
        expect(mockLimit).toHaveBeenCalledWith("127.0.0.1");
    });

    it("escapes LIKE wildcards from the query so they cannot shape the PostgREST filter", async () => {
        const orMock = jest.fn().mockReturnThis();
        mockFrom.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            or: orMock,
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        });

        const res = await GET(makeRequest("50%_off"));
        expect(res.status).toBe(200);

        const orArg = orMock.mock.calls[0][0] as string;
        // % and _ must be escaped (=> \% \_) so the wildcard is literal.
        expect(orArg).not.toMatch(/%50%_off%/);
    });

    it("reaches the DB safely for queries with commas/parentheses instead of throwing", async () => {
        const orMock = jest.fn().mockReturnThis();
        mockFrom.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            or: orMock,
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        });

        const res = await GET(makeRequest("aspirin, 500mg (test)"));
        expect(res.status).toBe(200);
        // The comma/paren query must be routed through PostgREST escaping rather
        // than crashing the handler.
        expect(orMock).toHaveBeenCalledTimes(1);
    });

    it("short-circuits before Redis/DB for queries under 2 characters", async () => {
        const res = await GET(makeRequest("a"));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual([]);
        expect(mockGet).not.toHaveBeenCalled();
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("rejects queries longer than 100 characters without touching Redis or DB", async () => {
        const res = await GET(makeRequest("a".repeat(101)));
        expect(res.status).toBe(400);
        expect(mockGet).not.toHaveBeenCalled();
        expect(mockFrom).not.toHaveBeenCalled();
    });
});
