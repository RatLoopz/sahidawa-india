/**
 * @jest-environment jsdom
 */
import { checkLasaConflicts } from "../lib/api";
import { fetchWithRetry } from "../lib/apiWithRetry";

// Mock fetchWithRetry to capture and control API requests
jest.mock("../lib/apiWithRetry", () => ({
    fetchWithRetry: jest.fn(),
}));

// Mock CSRF token fetches
global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ csrfToken: "mock-csrf-token" }),
});

describe("LASA Drug Lookup Cache & Deduplication", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return the cached result instantly on repeated checks for the same drug, and revalidate in the background", async () => {
        const mockResult1 = {
            hasConflicts: true,
            matches: [{ name: "Aspirin", type: "sound-alike", score: 0.85 }],
        };
        const mockResult2 = {
            hasConflicts: true,
            matches: [{ name: "Aspirin", type: "sound-alike", score: 0.9 }],
        };

        // 1st call: Network request is triggered
        (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockResult1),
        });

        const firstResult = await checkLasaConflicts("Aspirin");
        expect(firstResult).toEqual(mockResult1);
        expect(fetchWithRetry).toHaveBeenCalledTimes(1);

        // 2nd call: Return cached result instantly (mockResult1), and trigger revalidation in background (mockResult2)
        (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockResult2),
        });

        const secondResult = await checkLasaConflicts("Aspirin");
        // Result is returned instantly from the cache (value of first call)
        expect(secondResult).toEqual(mockResult1);

        // Wait a small tick to let the background revalidation complete
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Revalidation request should have been made
        expect(fetchWithRetry).toHaveBeenCalledTimes(2);

        // 3rd call: Returns the updated cached result (value of the revalidated second call)
        const thirdResult = await checkLasaConflicts("Aspirin");
        expect(thirdResult).toEqual(mockResult2);
    });

    it("should deduplicate concurrent in-flight requests for the same drug", async () => {
        const mockResult = { hasConflicts: false, matches: [] };

        let resolvePromise: any;
        const pendingPromise = new Promise((resolve) => {
            resolvePromise = resolve;
        });

        (fetchWithRetry as jest.Mock).mockImplementation(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                json: () => pendingPromise,
            })
        );

        // Fire multiple concurrent requests for the same medicine
        const p1 = checkLasaConflicts("Paracetamol");
        const p2 = checkLasaConflicts("Paracetamol");
        const p3 = checkLasaConflicts("Paracetamol");

        // Resolve the network call
        resolvePromise(mockResult);

        const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

        expect(r1).toEqual(mockResult);
        expect(r2).toEqual(mockResult);
        expect(r3).toEqual(mockResult);

        // Only 1 network request should have been made
        expect(fetchWithRetry).toHaveBeenCalledTimes(1);
    });
});
