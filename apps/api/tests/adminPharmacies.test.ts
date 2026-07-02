process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-role-key";

(global as any).WebSocket = (global as any).WebSocket || class {};

jest.mock("../src/db/client", () => ({
    supabase: {
        from: jest.fn(),
    },
}));

jest.mock("../src/middleware/auth", () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: "test-admin-uuid", role: "admin", email: "admin@example.com" };
        next();
    },
    optionalAuth: (_req: any, _res: any, next: any) => next(),
    requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock("../src/services/audit.service", () => ({
    logAdminAction: jest.fn().mockResolvedValue(undefined),
}));

import request from "supertest";
import app from "../src/app";
import { supabase } from "../src/db/client";
import { logAdminAction } from "../src/services/audit.service";

const PHARMACY_UUID_1 = "00000000-0000-4000-8000-000000000002";
const PHARMACY_UUID_2 = "00000000-0000-4000-8000-000000000003";

describe("Admin pharmacy moderation routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("lists pending pharmacies", async () => {
        const order = jest.fn().mockResolvedValue({
            data: [
                {
                    id: "pharmacy-1",
                    name: "Pending Pharmacy",
                    status: "pending",
                    created_at: "2026-06-08T10:00:00Z",
                },
            ],
            error: null,
        });
        const eq = jest.fn().mockReturnValue({ order });
        const select = jest.fn().mockReturnValue({ eq });

        (supabase.from as jest.Mock).mockReturnValue({ select });

        const res = await request(app)
            .get("/api/v1/admin/pharmacies/pending")
            .set("Authorization", "Bearer test-token");

        expect(res.status).toBe(200);
        expect(res.body.pharmacies).toHaveLength(1);
        expect(res.body.pharmacies[0].status).toBe("pending");
        expect(supabase.from).toHaveBeenCalledWith("pharmacies");
        expect(eq).toHaveBeenCalledWith("status", "pending");
        expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    });

    it("approves a pharmacy and logs the admin action", async () => {
        const single = jest.fn().mockResolvedValue({
            data: { id: PHARMACY_UUID_1, status: "approved", is_verified: true },
            error: null,
        });
        const select = jest.fn().mockReturnValue({ single });
        const eq = jest.fn().mockReturnValue({ select });
        const update = jest.fn().mockReturnValue({ eq });

        (supabase.from as jest.Mock).mockReturnValue({ update });

        const res = await request(app)
            .patch(`/api/v1/admin/pharmacies/${PHARMACY_UUID_1}/status`)
            .set("Authorization", "Bearer test-token")
            .send({ status: "approved" });

        expect(res.status).toBe(200);
        expect(res.body.pharmacy.status).toBe("approved");
        expect(update).toHaveBeenCalledWith({ status: "approved", is_verified: true });
        expect(eq).toHaveBeenCalledWith("id", PHARMACY_UUID_1);
        expect(logAdminAction).toHaveBeenCalledWith(
            "test-admin-uuid",
            "PHARMACY_APPROVED",
            "PHARMACY",
            PHARMACY_UUID_1,
            { status: "approved" }
        );
    });

    it("rejects a pharmacy without marking it verified", async () => {
        const single = jest.fn().mockResolvedValue({
            data: { id: PHARMACY_UUID_2, status: "rejected", is_verified: false },
            error: null,
        });
        const select = jest.fn().mockReturnValue({ single });
        const eq = jest.fn().mockReturnValue({ select });
        const update = jest.fn().mockReturnValue({ eq });

        (supabase.from as jest.Mock).mockReturnValue({ update });

        const res = await request(app)
            .patch(`/api/v1/admin/pharmacies/${PHARMACY_UUID_2}/status`)
            .set("Authorization", "Bearer test-token")
            .send({ status: "rejected" });

        expect(res.status).toBe(200);
        expect(update).toHaveBeenCalledWith({ status: "rejected", is_verified: false });
        expect(logAdminAction).toHaveBeenCalledWith(
            "test-admin-uuid",
            "PHARMACY_REJECTED",
            "PHARMACY",
            PHARMACY_UUID_2,
            { status: "rejected" }
        );
    });

    it("rejects invalid pharmacy statuses", async () => {
        const res = await request(app)
            .patch(`/api/v1/admin/pharmacies/${PHARMACY_UUID_1}/status`)
            .set("Authorization", "Bearer test-token")
            .send({ status: "pending" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Invalid status");
        expect(supabase.from).not.toHaveBeenCalled();
    });
});
