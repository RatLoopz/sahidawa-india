jest.mock("../src/middleware/auth", () => ({
    optionalAuth: (_req: any, _res: any, next: any) => next(),
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: "admin-user-id", email: "admin@example.com", role: "admin" };
        next();
    },
    requireRole:
        (..._roles: string[]) =>
        (_req: any, _res: any, next: any) => {
            next();
        },
}));

jest.mock("../src/services/audit.service", () => ({
    logAdminAction: jest.fn().mockResolvedValue(undefined),
}));

// Self-contained, table-aware mock — jest.mock factories are hoisted.
jest.mock("../src/db/client", () => {
    return { supabase: { from: jest.fn() } };
});

import request from "supertest";
import app from "../src/app";
import { supabase } from "../src/db/client";

const mockedSupabase = supabase as jest.Mocked<typeof supabase>;

describe("PATCH /api/v1/admin/reports/:id/status — district_alerts upsert", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("resets broadcasted=false on the district_alerts upsert when threshold is crossed", async () => {
        const updatedReport = {
            id: "report-id-123",
            district: "Delhi",
            reported_brand_name: "Fake Medicine",
            status: "verified_fake",
            is_escalated: false,
        };

        let upsertPayload: Record<string, unknown> | null = null;
        let upsertOpts: Record<string, unknown> | null = null;

        (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === "counterfeit_reports") {
                return {
                    update: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            select: jest.fn().mockReturnValue({
                                single: jest
                                    .fn()
                                    .mockResolvedValue({ data: updatedReport, error: null }),
                            }),
                        }),
                    }),
                    select: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                eq: jest.fn().mockResolvedValue({ count: 5, error: null }),
                            }),
                        }),
                    }),
                };
            }
            if (table === "district_alerts") {
                return {
                    upsert: jest
                        .fn()
                        .mockImplementation(
                            (payload: Record<string, unknown>, opts: Record<string, unknown>) => {
                                upsertPayload = payload;
                                upsertOpts = opts;
                                return Promise.resolve({ data: null, error: null });
                            }
                        ),
                };
            }
            if (table === "audit_logs") {
                return { insert: jest.fn().mockResolvedValue({ data: null, error: null }) };
            }
            return {};
        });

        const response = await request(app)
            .patch("/api/v1/admin/reports/report-id-123/status")
            .set("Authorization", "Bearer admin-token")
            .send({ status: "verified_fake" });

        expect(response.status).toBe(200);
        expect(upsertPayload).not.toBeNull();
        expect(upsertPayload).toHaveProperty("broadcasted", false);
        expect(upsertOpts).toEqual({ onConflict: "district" });
    });

    it("does not touch district_alerts when the report count is below threshold", async () => {
        const updatedReport = {
            id: "report-id-456",
            district: "Pune",
            reported_brand_name: "Some Medicine",
            status: "verified_fake",
            is_escalated: false,
        };

        const districtAlertsUpsert = jest.fn();

        (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === "counterfeit_reports") {
                return {
                    update: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            select: jest.fn().mockReturnValue({
                                single: jest
                                    .fn()
                                    .mockResolvedValue({ data: updatedReport, error: null }),
                            }),
                        }),
                    }),
                    select: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                eq: jest.fn().mockResolvedValue({ count: 2, error: null }),
                            }),
                        }),
                    }),
                };
            }
            if (table === "district_alerts") {
                return { upsert: districtAlertsUpsert };
            }
            if (table === "audit_logs") {
                return { insert: jest.fn().mockResolvedValue({ data: null, error: null }) };
            }
            return {};
        });

        const response = await request(app)
            .patch("/api/v1/admin/reports/report-id-456/status")
            .set("Authorization", "Bearer admin-token")
            .send({ status: "verified_fake" });

        expect(response.status).toBe(200);
        expect(districtAlertsUpsert).not.toHaveBeenCalled();
    });
});
