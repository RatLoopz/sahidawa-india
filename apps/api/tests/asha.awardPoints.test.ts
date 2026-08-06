// @ts-nocheck
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key";
process.env.DNS_LOOKUP_TIMEOUT_MS = process.env.DNS_LOOKUP_TIMEOUT_MS || "50";

(globalThis as unknown as { WebSocket: any }).WebSocket =
    (globalThis as unknown as { WebSocket: any }).WebSocket || class {};

jest.mock("../src/db/client", () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
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
import { supabase } from "../src/db/client";

describe("ASHA award-points", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("rejects unauthenticated mint attempts", async () => {
        const res = await request(app)
            .post("/api/v1/asha/award-points")
            .send({ points: 100, reason: "self mint" });

        expect(res.status).toBe(401);
    });

    it("does not mint points for authenticated clients", async () => {
        const res = await request(app)
            .post("/api/v1/asha/award-points")
            .set("Authorization", "Bearer test-token")
            .send({ points: 100, reason: "self mint" });

        expect(res.status).toBe(410);
        expect(res.body.error).toMatch(/disabled/i);
        expect(supabase.from).not.toHaveBeenCalled();
    });
});
