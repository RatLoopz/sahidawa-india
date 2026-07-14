import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { GET } from "../app/api/stats/route";

// Setup mocks for supabase
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

jest.mock("@/lib/supabase", () => ({
    supabase: {
        from: (table: string) => mockFrom(table),
    },
}));

describe("GET /api/stats", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns correct count statistics when supabase queries succeed", async () => {
        // Setup mock implementations for the chain
        mockFrom.mockImplementation((table: string) => {
            if (table === "drug_alerts") {
                return {
                    select: jest.fn().mockImplementation(() => {
                        return {
                            eq: jest.fn().mockImplementation((col: string, val: string) => {
                                let countVal = 0;
                                if (val === "banned") countVal = 10;
                                else if (val === "recalled") countVal = 15;
                                else if (val === "counterfeit") countVal = 5;
                                else if (val === "nsq") countVal = 20;

                                return Promise.resolve({
                                    count: countVal,
                                    error: null,
                                });
                            }),
                        };
                    }),
                };
            }
            if (table === "scan_history") {
                return {
                    select: jest.fn().mockImplementation(() => {
                        return Promise.resolve({
                            count: 100,
                            error: null,
                        });
                    }),
                };
            }
            if (table === "pharmacies") {
                return {
                    select: jest.fn().mockImplementation(() => {
                        return {
                            eq: jest.fn().mockImplementation((col: string, val: boolean) => {
                                return Promise.resolve({
                                    count: 50,
                                    error: null,
                                });
                            }),
                        };
                    }),
                };
            }
            return {};
        });

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
    });

    it("returns 500 error response if any supabase query fails", async () => {
        mockFrom.mockImplementation((table: string) => {
            if (table === "drug_alerts") {
                return {
                    select: jest.fn().mockImplementation(() => {
                        return {
                            eq: jest.fn().mockImplementation((col: string, val: string) => {
                                if (val === "banned") {
                                    return Promise.resolve({
                                        count: null,
                                        error: new Error("Database query failed"),
                                    });
                                }
                                return Promise.resolve({ count: 0, error: null });
                            }),
                        };
                    }),
                };
            }
            if (table === "scan_history") {
                return {
                    select: jest.fn().mockImplementation(() => {
                        return Promise.resolve({
                            count: 0,
                            error: null,
                        });
                    }),
                };
            }
            if (table === "pharmacies") {
                return {
                    select: jest.fn().mockImplementation(() => {
                        return {
                            eq: jest.fn().mockImplementation((col: string, val: boolean) => {
                                return Promise.resolve({
                                    count: 0,
                                    error: null,
                                });
                            }),
                        };
                    }),
                };
            }
            return {};
        });

        // Suppress console.error output in tests for expected errors
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        const response = await GET();
        expect(response.status).toBe(500);

        const data = await response.json();
        expect(data).toEqual({ error: "Internal Server Error" });

        consoleErrorSpy.mockRestore();
    });
});
