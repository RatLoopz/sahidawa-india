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
import { fetchVerifiedPharmaciesInBounds } from "@/lib/api";
import { fetchWithRetry } from "@/lib/apiWithRetry";

jest.mock("@/lib/apiWithRetry", () => ({
    fetchWithRetry: jest.fn(),
}));

const fetchWithRetryMock = jest.mocked(fetchWithRetry);

describe("fetchVerifiedPharmaciesInBounds", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("marks fallback responses so callers do not overwrite cached pharmacies", async () => {
        fetchWithRetryMock.mockRejectedValueOnce(new Error("network offline"));

        await expect(fetchVerifiedPharmaciesInBounds(10, 20, 30, 40)).resolves.toMatchObject({
            pharmacies: [],
            delta: false,
            fromNetwork: false,
        });
    });

    it("sends the since parameter and marks successful responses as network data", async () => {
        fetchWithRetryMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                pharmacies: [],
                syncedAt: "2026-06-22T12:00:00.000Z",
                delta: true,
            }),
        } as Response);

        await expect(
            fetchVerifiedPharmaciesInBounds(10, 20, 30, 40, "2026-06-22T11:00:00.000Z")
        ).resolves.toMatchObject({
            pharmacies: [],
            syncedAt: "2026-06-22T12:00:00.000Z",
            delta: true,
            fromNetwork: true,
        });

        expect(fetchWithRetryMock).toHaveBeenCalledWith(
            expect.stringContaining("since=2026-06-22T11%3A00%3A00.000Z"),
            expect.objectContaining({ timeout: 8000 })
        );
    });
});
