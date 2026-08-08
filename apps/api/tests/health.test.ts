// @ts-nocheck
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-role-key";

(globalThis as unknown as { WebSocket: any }).WebSocket =
    (globalThis as unknown as { WebSocket: any }).WebSocket || class {};

const mockLimit = jest.fn().mockResolvedValue({ data: [{ id: "1" }], error: null });

jest.mock("../src/db/client", () => ({
    supabase: {
        from: jest.fn(() => ({
            select: jest.fn(() => ({
                limit: mockLimit,
            })),
        })),
    },
    dbConfig: { isSupabaseOffline: false, setOffline: jest.fn(), setOnline: jest.fn() },
}));

jest.mock("../src/utils/redis", () => ({
    redisClient: {
        isOpen: true,
        ping: jest.fn().mockResolvedValue("PONG"),
        get: jest.fn(),
        set: jest.fn(),
        setEx: jest.fn(),
        del: jest.fn(),
    },
}));

jest.mock("../src/config/mlService", () => ({
    validateMlServiceConfig: jest.fn(),
    getMlServiceUrl: jest.fn(() => null),
    getMlAuthHeaders: jest.fn(() => ({})),
    MISSING_ML_SERVICE_URL_MESSAGE: "ML_SERVICE_URL missing",
}));

const mockIsLocalhostRequest = jest.fn(() => false);

jest.mock("../src/middleware/auth", () => ({
    requireAuth: (req: any, res: any, next: any) => {
        const token = req.headers.authorization?.slice(7);
        if (!token) {
            return res.status(401).json({ error: "Unauthorized: Missing access token" });
        }
        req.user = {
            id: "test-user-id",
            email: "test@example.com",
            role: token === "admin-token" ? "admin" : "user",
        };
        next();
    },
    optionalAuth: (_req: any, _res: any, next: any) => next(),
    requireRole:
        (...roles: string[]) =>
        (req: any, res: any, next: any) => {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication is required" });
            }
            if (!roles.includes(req.user.role)) {
                return res.status(403).json({ error: "Insufficient permissions" });
            }
            next();
        },
    isLocalhostRequest: (req: any) => mockIsLocalhostRequest(req),
    AuthenticatedRequest: Object,
}));

import request from "supertest";
import app from "../src/app";

describe("health endpoints", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockIsLocalhostRequest.mockReturnValue(false);
        mockLimit.mockResolvedValue({ data: [{ id: "1" }], error: null });
    });

    it("returns a shallow public /health payload", async () => {
        const res = await request(app).get("/health");

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: "ok" });
        expect(res.body).not.toHaveProperty("dependencies");
        expect(res.body).not.toHaveProperty("system");
        expect(res.body).not.toHaveProperty("environment");
        expect(JSON.stringify(res.body)).not.toContain("memoryUsage");
    });

    it("rejects unauthenticated /health/details from non-localhost", async () => {
        const res = await request(app).get("/health/details");

        expect(res.status).toBe(401);
        expect(res.body).not.toHaveProperty("dependencies");
    });

    it("rejects non-admin authenticated /health/details from non-localhost", async () => {
        const res = await request(app)
            .get("/health/details")
            .set("Authorization", "Bearer user-token");

        expect(res.status).toBe(403);
    });

    it("returns detailed health for admins", async () => {
        const res = await request(app)
            .get("/health/details")
            .set("Authorization", "Bearer admin-token");

        expect(res.status).toBe(200);
        expect(res.body.service).toBe("sahidawa-api");
        expect(res.body.dependencies).toBeDefined();
        expect(res.body.system).toBeDefined();
    });

    it("allows detailed health from localhost without auth", async () => {
        mockIsLocalhostRequest.mockReturnValue(true);

        const res = await request(app).get("/health/details");

        expect(res.status).toBe(200);
        expect(res.body.dependencies).toBeDefined();
    });
});
