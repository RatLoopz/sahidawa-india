process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key";

(global as any).WebSocket = (global as any).WebSocket || class {};

// Mock database supabase client
jest.mock("../src/db/client", () => {
    return {
        supabase: {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            range: jest.fn(),
        },
    };
});

// Mock authentication and role check middleware so they succeed automatically
jest.mock("../src/middleware/auth", () => {
    return {
        requireAuth: (req: any, res: any, next: any) => {
            req.user = { id: "test-admin-uuid", role: "admin", email: "admin@example.com" };
            next();
        },
        optionalAuth: (req: any, res: any, next: any) => {
            next();
        },
        requireRole: () => (req: any, res: any, next: any) => {
            next();
        },
    };
});

import request from "supertest";
import app from "../src/app";
import { supabase } from "../src/db/client";

const mockedSupabase = supabase as jest.Mocked<typeof supabase>;

describe("GET /api/v1/admin/logs", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should fetch administrative audit logs and format status/create action details properly", async () => {
        const mockLogs = [
            {
                id: "log-1",
                admin_id: "test-admin-uuid",
                action: "STATUS_VERIFIED_FAKE",
                target_type: "REPORT",
                target_id: "report-1-uuid",
                details: { status: "verified_fake" },
                created_at: "2026-05-30T10:00:00Z",
            },
            {
                id: "log-2",
                admin_id: "test-admin-uuid",
                action: "CREATE_MEDICINE",
                target_type: "MEDICINE",
                target_id: "medicine-2-uuid",
                details: { brand_name: "Mock Brand", generic_name: "Mock Generic" },
                created_at: "2026-05-30T09:00:00Z",
            },
            {
                id: "log-3",
                admin_id: "test-admin-uuid",
                action: "SOME_OTHER_ACTION",
                target_type: "REPORT",
                target_id: "report-3-uuid",
                details: { foo: "bar" },
                created_at: "2026-05-30T08:00:00Z",
            },
        ];

        const rangeMock = jest.fn().mockResolvedValue({
            data: mockLogs,
            error: null,
            count: 3,
        });

        const orderMock = jest.fn().mockReturnValue({
            range: rangeMock,
        });

        const selectMock = jest.fn().mockReturnValue({
            order: orderMock,
        });

        ((supabase as any).from as jest.Mock).mockReturnValue({
            select: selectMock,
        });

        const res = await request(app)
            .get("/api/v1/admin/logs?page=1&limit=2")
            .set("Authorization", "Bearer test-token");

        expect(res.status).toBe(200);
        expect(res.body.logs).toHaveLength(3);

        // Verify that the details are formatted correctly
        expect(res.body.logs[0].details).toBe("Updated report status to verified_fake");
        expect(res.body.logs[1].details).toBe("Created new medicine: Mock Brand (Mock Generic)");
        expect(res.body.logs[2].details).toBe('SOME_OTHER_ACTION: {"foo":"bar"}');

        // Check metadata
        expect(res.body.meta).toEqual({
            total: 3,
            page: 1,
            limit: 2,
            totalPages: 2,
        });

        expect(supabase.from).toHaveBeenCalledWith("audit_logs");
        expect(selectMock).toHaveBeenCalledWith("*", { count: "exact" });
        expect(orderMock).toHaveBeenCalledWith("created_at", { ascending: false });
        expect(rangeMock).toHaveBeenCalledWith(0, 1);
    });

    it("should handle error states gracefully", async () => {
        const rangeMock = jest.fn().mockResolvedValue({
            data: null,
            error: { message: "Database failure" },
            count: 0,
        });

        const orderMock = jest.fn().mockReturnValue({
            range: rangeMock,
        });

        const selectMock = jest.fn().mockReturnValue({
            order: orderMock,
        });

        ((supabase as any).from as jest.Mock).mockReturnValue({
            select: selectMock,
        });

        const res = await request(app)
            .get("/api/v1/admin/logs")
            .set("Authorization", "Bearer test-token");

        expect(res.status).toBe(500);
        expect(res.body.error).toBe("Failed to fetch audit logs");
    });
});
