import { Request, Response, NextFunction } from "express";
import { requestIdMiddleware, getRequestId, REQUEST_ID_HEADER } from "../src/middleware/requestId";

// ── Helpers ────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mockReqResNext(headerValue?: string) {
    const req = {
        headers: headerValue ? { [REQUEST_ID_HEADER]: headerValue } : {},
    } as unknown as Request;

    const resHeaders: Record<string, string> = {};
    const res = {
        setHeader: jest.fn((name: string, value: string) => {
            resHeaders[name] = value;
        }),
        getHeader: (name: string) => resHeaders[name],
    } as unknown as Response;

    let nextCalled = false;
    const next: NextFunction = (() => {
        nextCalled = true;
    }) as NextFunction;

    return { req, res, next, resHeaders, isNextCalled: () => nextCalled };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("requestIdMiddleware", () => {
    it("generates a UUID v4 when no x-request-id header is provided", () => {
        const { req, res, next } = mockReqResNext();
        requestIdMiddleware(req, res, next);

        const id = (req as Request & { requestId: string }).requestId;
        expect(id).toMatch(UUID_RE);
    });

    it("preserves the incoming x-request-id header when present", () => {
        const customId = "upstream-trace-abc-123";
        const { req, res, next } = mockReqResNext(customId);
        requestIdMiddleware(req, res, next);

        const id = (req as Request & { requestId: string }).requestId;
        expect(id).toBe(customId);
    });

    it("sets x-request-id on the response header", () => {
        const { req, res, next, resHeaders } = mockReqResNext();
        requestIdMiddleware(req, res, next);

        expect(res.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, expect.any(String));
        expect(resHeaders[REQUEST_ID_HEADER]).toMatch(UUID_RE);
    });

    it("echoes the same ID on the response when an incoming ID is provided", () => {
        const customId = "incoming-request-id-999";
        const { req, res, next, resHeaders } = mockReqResNext(customId);
        requestIdMiddleware(req, res, next);

        expect(resHeaders[REQUEST_ID_HEADER]).toBe(customId);
    });

    it("calls next() to pass control to the next middleware", () => {
        const { req, res, next, isNextCalled } = mockReqResNext();
        requestIdMiddleware(req, res, next);

        expect(isNextCalled()).toBe(true);
    });

    it("makes getRequestId() return the correct ID inside the request context", (done) => {
        const customId = "context-test-id";
        const req = {
            headers: { [REQUEST_ID_HEADER]: customId },
        } as unknown as Request;

        const res = {
            setHeader: jest.fn(),
        } as unknown as Response;

        const next: NextFunction = (() => {
            // Inside the AsyncLocalStorage context, getRequestId() should work
            expect(getRequestId()).toBe(customId);
            done();
        }) as NextFunction;

        requestIdMiddleware(req, res, next);
    });

    it("returns undefined from getRequestId() outside any request context", () => {
        expect(getRequestId()).toBeUndefined();
    });

    it("assigns unique IDs to concurrent requests", () => {
        const ids: string[] = [];
        for (let i = 0; i < 50; i++) {
            const { req, res, next } = mockReqResNext();
            requestIdMiddleware(req, res, next);
            ids.push((req as Request & { requestId: string }).requestId);
        }

        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(50);
    });
});

describe("getRequestId (context isolation)", () => {
    it("isolates request IDs across nested contexts", (done) => {
        const id1 = "request-1";
        const id2 = "request-2";
        let innerResolved = false;

        const req1 = { headers: { [REQUEST_ID_HEADER]: id1 } } as unknown as Request;
        const res1 = { setHeader: jest.fn() } as unknown as Response;

        const req2 = { headers: { [REQUEST_ID_HEADER]: id2 } } as unknown as Request;
        const res2 = { setHeader: jest.fn() } as unknown as Response;

        requestIdMiddleware(req1, res1, (() => {
            expect(getRequestId()).toBe(id1);

            // Simulate a second concurrent request
            requestIdMiddleware(req2, res2, (() => {
                expect(getRequestId()).toBe(id2);
                innerResolved = true;
            }) as NextFunction);

            // After inner context exits, outer context should still be id1
            expect(getRequestId()).toBe(id1);
            expect(innerResolved).toBe(true);
            done();
        }) as NextFunction);
    });
});

describe("serviceFetch x-request-id propagation", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        global.fetch = jest.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it("propagates x-request-id on outgoing calls inside a request context", (done) => {
        const testId = "propagation-test-id";
        const req = { headers: { [REQUEST_ID_HEADER]: testId } } as unknown as Request;
        const res = { setHeader: jest.fn() } as unknown as Response;

        requestIdMiddleware(req, res, (async () => {
            // Dynamically import to ensure the mock is in place
            const { serviceFetch } = await import("../src/utils/serviceClient");
            await serviceFetch("https://ml-service.example.com/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ test: true }),
            });

            const fetchMock = global.fetch as jest.Mock;
            expect(fetchMock).toHaveBeenCalledTimes(1);

            const [, init] = fetchMock.mock.calls[0];
            const headers = new Headers(init.headers);
            expect(headers.get("x-request-id")).toBe(testId);
            expect(headers.get("Content-Type")).toBe("application/json");
            done();
        }) as NextFunction);
    });

    it("does not set x-request-id outside a request context", async () => {
        const { serviceFetch } = await import("../src/utils/serviceClient");
        await serviceFetch("https://example.com/health");

        const fetchMock = global.fetch as jest.Mock;
        const [, init] = fetchMock.mock.calls[0];
        const headers = new Headers(init.headers);
        expect(headers.get("x-request-id")).toBeNull();
    });

    it("does not overwrite an explicitly set x-request-id header", (done) => {
        const contextId = "context-id";
        const explicitId = "explicit-override-id";
        const req = { headers: { [REQUEST_ID_HEADER]: contextId } } as unknown as Request;
        const res = { setHeader: jest.fn() } as unknown as Response;

        requestIdMiddleware(req, res, (async () => {
            const { serviceFetch } = await import("../src/utils/serviceClient");
            await serviceFetch("https://example.com/api", {
                headers: { "x-request-id": explicitId },
            });

            const fetchMock = global.fetch as jest.Mock;
            const [, init] = fetchMock.mock.calls[0];
            const headers = new Headers(init.headers);
            expect(headers.get("x-request-id")).toBe(explicitId);
            done();
        }) as NextFunction);
    });
});
