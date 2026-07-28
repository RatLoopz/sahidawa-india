import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const mockFrom = jest.fn();
const mockServiceRoleFrom = jest.fn();
const mockCreateServiceRoleSupabaseClient = jest.fn(() => ({
    from: mockServiceRoleFrom,
}));

jest.mock("@/lib/supabase", () => ({
    supabase: {
        from: (table: string) => mockFrom(table),
    },
}));

jest.mock("@/lib/rateLimitMetrics", () => ({
    createServiceRoleSupabaseClient: mockCreateServiceRoleSupabaseClient,
}));

import { GET } from "../app/api/stats/route";

type CountResult = {
    count: number | null;
    error: Error | null;
};

const alertCounts: Record<string, number> = {
    Banned: 10,
    Recalled: 15,
    Spurious: 5,
    NSQ: 20,
};

function arrangePublicStatsQueries() {
    mockFrom.mockImplementation((table: string) => {
        if (table === "drug_alerts") {
            return {
                select: jest.fn(() => ({
                    eq: jest.fn((_column: string, value: string) =>
                        Promise.resolve({
                            count: alertCounts[value] ?? 0,
                            error: null,
                        })
                    ),
                })),
            };
        }

        if (table === "pharmacies") {
            return {
                select: jest.fn(() => ({
                    eq: jest.fn(() => Promise.resolve({ count: 50, error: null })),
                })),
            };
        }

        throw new Error(`Unexpected anonymous table query: ${table}`);
    });
}

function arrangeScanCount(result: CountResult) {
    const select = jest.fn(() => Promise.resolve(result));
    mockServiceRoleFrom.mockImplementation((table: string) => {
        if (table !== "scan_history") {
            throw new Error(`Unexpected service-role table query: ${table}`);
        }
        return { select };
    });
    return select;
}

describe("GET /api/stats", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        arrangePublicStatsQueries();
    });

    it("returns aggregate statistics using the service-role client for scan history", async () => {
        const scanSelect = arrangeScanCount({ count: 100, error: null });

        const response = await GET();
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data).toEqual({
            banned: 10,
            recalled: 15,
            counterfeit: 5,
            nsq: 20,
            totalScans: 100,
            verifiedPharmacies: 50,
        });
        expect(mockCreateServiceRoleSupabaseClient).toHaveBeenCalledTimes(1);
        expect(mockServiceRoleFrom).toHaveBeenCalledWith("scan_history");
        expect(mockFrom).not.toHaveBeenCalledWith("scan_history");
        expect(scanSelect).toHaveBeenCalledWith("*", { count: "exact", head: true });
        expect(data).not.toHaveProperty("scan_history");
        expect(data).not.toHaveProperty("scans");
    });

    it("preserves a legitimate zero scan count", async () => {
        arrangeScanCount({ count: 0, error: null });

        const response = await GET();

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            banned: 10,
            recalled: 15,
            counterfeit: 5,
            nsq: 20,
            totalScans: 0,
            verifiedPharmacies: 50,
        });
    });

    it("returns 500 instead of reporting zero when the scan count query fails", async () => {
        arrangeScanCount({ count: null, error: new Error("Database query failed") });

        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        const response = await GET();
        expect(response.status).toBe(500);

        const data = await response.json();
        expect(data).toEqual({ error: "Internal Server Error" });
        expect(data).not.toHaveProperty("totalScans");

        consoleErrorSpy.mockRestore();
    });
});
