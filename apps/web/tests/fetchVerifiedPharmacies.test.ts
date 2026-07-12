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
import { PHARMACY_SEARCH_RADIUS_DEFAULT_KM } from "@sahidawa/shared";

// Isolate the network layer so we can inspect the request URL that
// fetchVerifiedPharmacies builds.
jest.mock("../lib/apiWithRetry", () => ({
    fetchWithRetry: jest.fn(),
    offlineRequestQueue: { enqueue: jest.fn() },
}));

import { fetchVerifiedPharmacies } from "../lib/api";
import { fetchWithRetry } from "../lib/apiWithRetry";

const mockFetch = fetchWithRetry as jest.MockedFunction<typeof fetchWithRetry>;

function okResponse() {
    return {
        ok: true,
        json: async () => ({ pharmacies: [] }),
    } as unknown as Response;
}

describe("fetchVerifiedPharmacies radius", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch.mockResolvedValue(okResponse());
    });

    it("requests the shared default radius when none is passed", async () => {
        await fetchVerifiedPharmacies(28.61, 77.2);

        const url = mockFetch.mock.calls[0][0] as string;
        expect(url).toContain(`radius=${PHARMACY_SEARCH_RADIUS_DEFAULT_KM}`);
        expect(url).toContain("radius=50");
    });

    it("uses an explicit radius when one is passed", async () => {
        await fetchVerifiedPharmacies(28.61, 77.2, 123);

        const url = mockFetch.mock.calls[0][0] as string;
        expect(url).toContain("radius=123");
    });
});
