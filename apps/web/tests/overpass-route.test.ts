import { NextRequest } from "next/server";
import { POST } from "../app/api/overpass/route";

const limitBuckets = new Map<string, { count: number; resetAt: number }>();
const mockLimit = jest.fn().mockImplementation(async (ip: string) => {
    const now = Date.now();
    let bucket = limitBuckets.get(ip);
    if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + 60000 };
        limitBuckets.set(ip, bucket);
    }
    bucket.count += 1;
    if (bucket.count > 10) {
        return { success: false, limit: 10, remaining: 0, reset: bucket.resetAt };
    }
    return { success: true, limit: 10, remaining: 10 - bucket.count, reset: bucket.resetAt };
});

jest.mock("@/lib/rateLimit", () => ({
    rateLimit: {
        limit: (ip: string) => mockLimit(ip),
    },
}));

function buildRequest(body: any, headers: Record<string, string> = {}) {
    return new Request("http://localhost/api/overpass", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...headers,
        },
        body: JSON.stringify(body),
    }) as NextRequest;
}

describe("POST /api/overpass", () => {
    let fetchMock: jest.Mock;

    beforeEach(() => {
        limitBuckets.clear();
        mockLimit.mockClear();

        fetchMock = jest.fn().mockImplementation(() => {
            return Promise.resolve({
                ok: true,
                status: 200,
                json: async () => ({ elements: [] }),
            });
        });
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("accepts valid requests and calls mirrors", async () => {
        const response = await POST(buildRequest({ query: "node(123);" }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ elements: [] });
        expect(fetchMock).toHaveBeenCalled();
    });

    it("rejects non-string queries", async () => {
        const response = await POST(buildRequest({ query: 123 }));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe("Missing or invalid query");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects empty queries", async () => {
        const response = await POST(buildRequest({ query: "   " }));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe("Missing or invalid query");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects missing queries", async () => {
        const response = await POST(buildRequest({}));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe("Missing or invalid query");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects invalid JSON", async () => {
        const req = new Request("http://localhost/api/overpass", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "invalid json",
        }) as NextRequest;

        const response = await POST(req);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe("Invalid JSON body");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects oversized queries", async () => {
        const response = await POST(buildRequest({ query: "a".repeat(10001) }));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe("Query exceeds maximum length");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns 429 when rate limit is exceeded", async () => {
        jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
        const headers = { "x-forwarded-for": "203.0.113.10" };

        for (let i = 0; i < 10; i += 1) {
            const response = await POST(buildRequest({ query: "node(123);" }, headers));
            expect(response.status).toBe(200);
        }

        const response = await POST(buildRequest({ query: "node(123);" }, headers));
        const body = await response.json();

        expect(response.status).toBe(429);
        expect(body.error).toBe("Too many requests. Please try again in a few moments.");
        expect(fetchMock).toHaveBeenCalledTimes(50); // 10 successful requests * 5 mirrors
    });
});
