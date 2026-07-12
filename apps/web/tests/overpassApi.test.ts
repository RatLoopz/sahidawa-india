import {
    describe,
    it,
    expect,
    jest,
    beforeEach,
    afterEach,
    beforeAll,
    afterAll,
} from "@jest/globals";
import { fetchPharmacies } from "../app/[locale]/map/overpassApi";

function createJsonResponse(body: unknown, ok = true, status = 200) {
    return {
        ok,
        status,
        json: jest.fn().mockResolvedValue(body),
    } as unknown as Response;
}

describe("overpassApi", () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it("aborts slower client mirror requests after the first valid response is parsed", async () => {
        let loserSignal: AbortSignal | null = null;

        const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);

            if (url.includes("overpass.private.coffee")) {
                return Promise.resolve(
                    createJsonResponse({
                        elements: [
                            {
                                type: "node",
                                id: 101,
                                lat: 28.6139,
                                lon: 77.209,
                                tags: { name: "Fast Pharmacy" },
                            },
                        ],
                    })
                );
            }

            if (url.includes("overpass-api.de")) {
                loserSignal = init?.signal ?? null;
                return new Promise<Response>((_, reject) => {
                    init?.signal?.addEventListener("abort", () => {
                        const error = new Error("Aborted");
                        error.name = "AbortError";
                        reject(error);
                    });
                });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        global.fetch = fetchMock as unknown as typeof fetch;

        const pharmacies = await fetchPharmacies(28.6139, 77.209);

        expect(pharmacies).toEqual([
            expect.objectContaining({
                id: 101,
                name: "Fast Pharmacy",
            }),
        ]);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(loserSignal?.aborted).toBe(true);
    });

    it("falls back to the proxy and preserves the final failure when all mirrors fail", async () => {
        const fetchMock = jest.fn((input: RequestInfo | URL) => {
            const url = String(input);

            if (url.startsWith("https://")) {
                return Promise.reject(new Error("Direct mirror failed"));
            }

            if (url === "/api/overpass") {
                return Promise.resolve(createJsonResponse({ error: "proxy failed" }, false, 503));
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        global.fetch = fetchMock as unknown as typeof fetch;

        await expect(fetchPharmacies(28.6139, 77.209)).rejects.toThrow(
            "All Overpass mirrors and proxy failed to respond"
        );
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("keeps timeout abort behavior for direct mirrors before proxy fallback", async () => {
        jest.useFakeTimers();
        const directSignals: AbortSignal[] = [];

        const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);

            if (url.startsWith("https://")) {
                if (init?.signal) directSignals.push(init.signal);

                return new Promise<Response>((_, reject) => {
                    init?.signal?.addEventListener("abort", () => {
                        const error = new Error("Timed out");
                        error.name = "AbortError";
                        reject(error);
                    });
                });
            }

            if (url === "/api/overpass") {
                return Promise.resolve(createJsonResponse({ elements: [] }));
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        global.fetch = fetchMock as unknown as typeof fetch;

        const resultPromise = fetchPharmacies(28.6139, 77.209);
        await Promise.resolve();
        jest.advanceTimersByTime(4000);

        await expect(resultPromise).resolves.toEqual([]);
        expect(directSignals).toHaveLength(2);
        expect(directSignals.every((signal) => signal.aborted)).toBe(true);
    });
});
