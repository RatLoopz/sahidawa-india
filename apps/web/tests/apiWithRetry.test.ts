import { fetchWithRetry } from "../lib/apiWithRetry";

describe("fetchWithRetry", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    test("A. Abort during fetch (simulate fetch throwing AbortError)", async () => {
        const controller = new AbortController();
        const fetchMock = global.fetch as jest.Mock;
        fetchMock.mockImplementation(async () => {
            const error = new Error("AbortError");
            error.name = "AbortError";
            throw error;
        });

        controller.abort();

        await expect(
            fetchWithRetry("https://example.com", { signal: controller.signal })
        ).rejects.toThrow("Request was cancelled.");
        expect(fetchMock).toHaveBeenCalledTimes(0);
    });

    test("B. Abort during backoff", async () => {
        const controller = new AbortController();
        const fetchMock = global.fetch as jest.Mock;

        fetchMock.mockImplementationOnce(async () => {
            return {
                ok: false,
                status: 500,
                clone: () => ({ text: async () => "" }),
            };
        });

        const promise = fetchWithRetry("https://example.com", { signal: controller.signal }, { initialDelayMs: 1000 });

        // Await next tick so fetch finishes and sleep starts
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        // Abort while it is sleeping
        controller.abort();

        await expect(promise).rejects.toThrow("Request was cancelled.");
        expect(fetchMock).toHaveBeenCalledTimes(1); // Fetched once, no retry
    });

    test("C. Already-aborted signal", async () => {
        const controller = new AbortController();
        controller.abort();
        const fetchMock = global.fetch as jest.Mock;

        await expect(
            fetchWithRetry("https://example.com", { signal: controller.signal })
        ).rejects.toThrow("Request was cancelled.");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test("D. Normal retry works properly", async () => {
        const fetchMock = global.fetch as jest.Mock;
        fetchMock
            .mockImplementationOnce(async () => {
                return {
                    ok: false,
                    status: 500,
                    clone: () => ({ text: async () => "" }),
                };
            })
            .mockImplementationOnce(async () => {
                return { ok: true, status: 200 };
            });

        const promise = fetchWithRetry("https://example.com", {}, { initialDelayMs: 1000, backoffMultiplier: 1 });

        // Advance timers to trigger retry
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        jest.advanceTimersByTime(1100);

        const response = await promise;
        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test("E. Retry-After on 429 (seconds)", async () => {
        const fetchMock = global.fetch as jest.Mock;
        fetchMock
            .mockImplementationOnce(async () => {
                return {
                    ok: false,
                    status: 429,
                    clone: () => ({ text: async () => "" }),
                    headers: new Headers({ "Retry-After": "5" }),
                };
            })
            .mockImplementationOnce(async () => {
                return { ok: true, status: 200 };
            });

        const promise = fetchWithRetry("https://example.com", {}, { initialDelayMs: 1000 });

        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        
        // Wait 4000ms, should not have fired yet
        jest.advanceTimersByTime(4000);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // Wait another 1100ms, should fire now (since delay is 5000)
        jest.advanceTimersByTime(1100);
        const response = await promise;
        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test("F. Retry-After on 503 (HTTP date)", async () => {
        const fetchMock = global.fetch as jest.Mock;
        const futureDate = new Date(Date.now() + 10000).toUTCString();
        fetchMock
            .mockImplementationOnce(async () => {
                return {
                    ok: false,
                    status: 503,
                    clone: () => ({ text: async () => "" }),
                    headers: new Headers({ "Retry-After": futureDate }),
                };
            })
            .mockImplementationOnce(async () => {
                return { ok: true, status: 200 };
            });

        const promise = fetchWithRetry("https://example.com", {}, { initialDelayMs: 1000 });

        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        
        // Wait 9000ms
        jest.advanceTimersByTime(9000);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // Wait another 1100ms (total 10100ms)
        jest.advanceTimersByTime(1100);
        const response = await promise;
        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test("G. Invalid/missing Retry-After falls back to normal backoff", async () => {
        const fetchMock = global.fetch as jest.Mock;
        fetchMock
            .mockImplementationOnce(async () => {
                return {
                    ok: false,
                    status: 429,
                    clone: () => ({ text: async () => "" }),
                    headers: new Headers({ "Retry-After": "invalid_date_or_seconds" }),
                };
            })
            .mockImplementationOnce(async () => {
                return { ok: true, status: 200 };
            });

        const promise = fetchWithRetry("https://example.com", {}, { initialDelayMs: 1000, backoffMultiplier: 1 });

        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        
        // Normal delay is ~1000ms + jitter. By 2500ms it should definitely fire.
        jest.advanceTimersByTime(2500);
        
        const response = await promise;
        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test("H. Timer cleanup on abort", async () => {
        const controller = new AbortController();
        const fetchMock = global.fetch as jest.Mock;

        fetchMock.mockImplementationOnce(async () => {
            return {
                ok: false,
                status: 500,
                clone: () => ({ text: async () => "" }),
            };
        });

        const promise = fetchWithRetry("https://example.com", { signal: controller.signal }, { initialDelayMs: 10000 });

        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        // Abort
        controller.abort();

        await expect(promise).rejects.toThrow("Request was cancelled.");

        // Fast forward 20000ms. If timer wasn't cleared, it might execute and crash or try to fetch again.
        jest.advanceTimersByTime(20000);
        
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(jest.getTimerCount()).toBe(0);
    });
});
