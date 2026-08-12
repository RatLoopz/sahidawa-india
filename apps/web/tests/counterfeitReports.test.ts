/** @jest-environment jsdom */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { getVerifiedReportCount, FAKE_MEDICINE_HUNTER_THRESHOLD } from "@/lib/counterfeitReports";

const mockSelect = jest.fn();
const mockEq = jest.fn();

jest.mock("@/lib/supabase", () => ({
    supabase: {
        from: jest.fn(() => ({
            select: (...args: unknown[]) => mockSelect(...args),
        })),
    },
}));

beforeEach(() => {
    mockSelect.mockReset();
    mockEq.mockReset();
    // Chain: select() -> eq() -> eq() -> { count, error }
    mockSelect.mockReturnValue({
        eq: (...args: unknown[]) => mockEq(...args),
    });
    mockEq.mockReturnValue({
        eq: () => ({ count: 0, error: null }),
    });
});

describe("lib/counterfeitReports", () => {
    it("exposes a 5-report threshold for the badge", () => {
        expect(FAKE_MEDICINE_HUNTER_THRESHOLD).toBe(5);
    });

    it("returns the verified report count for the user", async () => {
        mockEq.mockReturnValue({
            eq: () => ({ count: 7, error: null }),
        });

        const count = await getVerifiedReportCount("user-123");

        expect(count).toBe(7);
        expect(mockSelect).toHaveBeenCalledWith("id", { count: "exact", head: true });
    });

    it("returns 0 when the user has no verified reports", async () => {
        mockEq.mockReturnValue({
            eq: () => ({ count: 0, error: null }),
        });

        const count = await getVerifiedReportCount("user-empty");

        expect(count).toBe(0);
    });

    it("filters by user_id and status='verified'", async () => {
        const eqCalls: Array<[string, unknown]> = [];
        mockSelect.mockReturnValue({
            eq: (col: string, val: unknown) => {
                eqCalls.push([col, val]);
                return {
                    eq: (col2: string, val2: unknown) => {
                        eqCalls.push([col2, val2]);
                        return { count: 3, error: null };
                    },
                };
            },
        });

        const count = await getVerifiedReportCount("user-abc");

        expect(count).toBe(3);
        expect(eqCalls).toEqual([
            ["user_id", "user-abc"],
            ["status", "verified"],
        ]);
    });

    it("swallows errors and returns 0 so the profile page never breaks", async () => {
        mockEq.mockReturnValue({
            eq: () => ({
                count: null,
                error: { message: "relation counterfeit_reports does not exist" },
            }),
        });

        const count = await getVerifiedReportCount("user-err");

        expect(count).toBe(0);
    });
});
