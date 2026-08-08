// @ts-nocheck
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-role-key";
process.env.DNS_LOOKUP_TIMEOUT_MS = process.env.DNS_LOOKUP_TIMEOUT_MS || "50";

(globalThis as unknown as { WebSocket: any }).WebSocket =
    (globalThis as unknown as { WebSocket: any }).WebSocket || class {};

const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockMaybeSingle = jest.fn();
const mockSingle = jest.fn();

jest.mock("../src/db/client", () => ({
    supabase: {
        from: jest.fn(() => ({
            select: mockSelect,
            insert: mockInsert,
        })),
    },
}));

jest.mock("../src/middleware/auth", () => ({
    requireAuth: (req: any, res: any, next: any) => {
        const token = req.headers.authorization?.slice(7);
        if (!token) {
            return res.status(401).json({ error: "Unauthenticated" });
        }
        req.user = { id: "test-user-id", email: "test@example.com", role: "user" };
        next();
    },
    optionalAuth: (_req: any, _res: any, next: any) => next(),
    requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

import request from "supertest";
import app from "../src/app";

describe("ASHA dashboard stats role default", () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockSelect.mockReturnValue({
            eq: mockEq,
        });
        mockEq.mockReturnValue({
            maybeSingle: mockMaybeSingle,
            order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
        });
        mockInsert.mockReturnValue({
            select: jest.fn().mockReturnValue({
                single: mockSingle,
            }),
        });
    });

    it("creates missing profiles with role user, not asha_worker", async () => {
        mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
        mockSingle.mockResolvedValueOnce({
            data: {
                id: "test-user-id",
                role: "user",
                points: 0,
                badges: [],
            },
            error: null,
        });

        const res = await request(app)
            .get("/api/v1/asha/dashboard/stats")
            .set("Authorization", "Bearer test-token");

        expect(res.status).toBe(200);
        expect(mockInsert).toHaveBeenCalledWith({
            id: "test-user-id",
            role: "user",
            points: 0,
            badges: [],
        });
        expect(res.body.role).toBe("user");
        expect(mockInsert.mock.calls[0][0].role).not.toBe("asha_worker");
    });
});
