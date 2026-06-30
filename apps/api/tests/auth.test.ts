import { NextFunction, Response } from "express";
import { User } from "@supabase/supabase-js";
import {
    AuthenticatedRequest,
    createAuthMiddleware,
    createOptionalAuthMiddleware,
    requireRole,
    getUserRole,
} from "../src/middleware/auth";

const createResponse = () => {
    const res = {
        statusCode: 200,
        body: undefined as unknown,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        json(payload: unknown) {
            this.body = payload;
            return this;
        },
    };

    return res as Response & { statusCode: number; body: unknown };
};

const createClient = (user: unknown, error: unknown = null) => ({
    auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user }, error }),
    },
});

describe("auth middleware", () => {
    it("rejects requests without an authorization header", async () => {
        const req = { headers: {} } as AuthenticatedRequest;
        const res = createResponse();
        const next = jest.fn();

        await createAuthMiddleware(createClient(null) as never)(req, res, next as NextFunction);

        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: "Unauthorized: Missing access token" });
        expect(next).not.toHaveBeenCalled();
    });

    it("rejects malformed bearer tokens", async () => {
        const req = { headers: { authorization: "Token abc" } } as AuthenticatedRequest;
        const res = createResponse();
        const next = jest.fn();

        await createAuthMiddleware(createClient(null) as never)(req, res, next as NextFunction);

        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    it("rejects invalid Supabase tokens", async () => {
        const req = { headers: { authorization: "Bearer invalid-token" } } as AuthenticatedRequest;
        const res = createResponse();
        const next = jest.fn();

        await createAuthMiddleware(createClient(null, new Error("invalid")) as never)(
            req,
            res,
            next as NextFunction
        );

        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: "Unauthorized: Invalid or expired token" });
        expect(next).not.toHaveBeenCalled();
    });

    it("attaches authenticated user details for valid user tokens", async () => {
        const req = { headers: { authorization: "Bearer valid-token" } } as AuthenticatedRequest;
        const res = createResponse();
        const next = jest.fn();

        await createAuthMiddleware(
            createClient({
                id: "user-1",
                email: "user@example.com",
                app_metadata: {},
                user_metadata: {},
            }) as never
        )(req, res, next as NextFunction);

        expect(next).toHaveBeenCalled();
        expect(req.user?.id).toBe("user-1");
        expect(req.user?.email).toBe("user@example.com");
        expect(req.user?.role).toBe("user");
    });

    it("allows admin-only handlers for admin users", () => {
        const req = { user: { role: "admin" } } as AuthenticatedRequest;
        const res = createResponse();
        const next = jest.fn();

        requireRole("admin")(req, res, next as NextFunction);

        expect(next).toHaveBeenCalled();
        expect(res.statusCode).toBe(200);
    });

    it("rejects user role requests for admin-only handlers", () => {
        const req = { user: { role: "user" } } as AuthenticatedRequest;
        const res = createResponse();
        const next = jest.fn();

        requireRole("admin")(req, res, next as NextFunction);

        expect(res.statusCode).toBe(403);
        expect(res.body).toEqual({ error: "Insufficient permissions" });
        expect(next).not.toHaveBeenCalled();
    });
});

describe("auth middleware — security: BYPASS_AUTH_FOR_TESTING hardening (auth bypass admin-default fix)", () => {
    const ORIGINAL_ENV = { ...process.env };
    const { dbConfig } = jest.requireActual("../src/db/client");

    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
        dbConfig.isSupabaseOffline = false;
    });

    it("rejects the bypass entirely when Supabase is offline but env vars are unset (no change in baseline behavior)", async () => {
        dbConfig.isSupabaseOffline = true;
        delete process.env.BYPASS_AUTH_FOR_TESTING;

        const req = {
            headers: { authorization: "Bearer some-token" },
            ip: "127.0.0.1",
        } as AuthenticatedRequest;
        const res = createResponse();
        const next = jest.fn();

        await createAuthMiddleware(createClient(null) as never)(req, res, next as NextFunction);

        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    it("allows the bypass from localhost when NODE_ENV=development and BYPASS_AUTH_FOR_TESTING=true", async () => {
        dbConfig.isSupabaseOffline = true;
        process.env.NODE_ENV = "development";
        process.env.BYPASS_AUTH_FOR_TESTING = "true";
        delete process.env.MOCK_USER_ROLE;

        const req = {
            headers: { authorization: "Bearer some-token" },
            ip: "127.0.0.1",
        } as AuthenticatedRequest;
        const res = createResponse();
        const next = jest.fn();

        await createAuthMiddleware(createClient(null) as never)(req, res, next as NextFunction);

        expect(next).toHaveBeenCalled();
        expect(req.user?.role).toBe("user"); // safe default, not "admin"
    });

    it("allows the bypass from the ::1 IPv6 loopback address as well", async () => {
        dbConfig.isSupabaseOffline = true;
        process.env.NODE_ENV = "development";
        process.env.BYPASS_AUTH_FOR_TESTING = "true";

        const req = {
            headers: { authorization: "Bearer some-token" },
            ip: "::1",
        } as AuthenticatedRequest;
        const res = createResponse();
        const next = jest.fn();

        await createAuthMiddleware(createClient(null) as never)(req, res, next as NextFunction);

        expect(next).toHaveBeenCalled();
        expect(req.user?.role).toBe("user");
    });

    it("denies the bypass for a non-localhost request even with both env vars set", async () => {
        dbConfig.isSupabaseOffline = true;
        process.env.NODE_ENV = "development";
        process.env.BYPASS_AUTH_FOR_TESTING = "true";

        const req = {
            headers: { authorization: "Bearer some-token" },
            ip: "203.0.113.42", // arbitrary public IP
        } as AuthenticatedRequest;
        const res = createResponse();
        const next = jest.fn();

        await createAuthMiddleware(createClient(null) as never)(req, res, next as NextFunction);

        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    it("defaults the mock user to role 'user' when MOCK_USER_ROLE is unset, never 'admin'", async () => {
        dbConfig.isSupabaseOffline = true;
        process.env.NODE_ENV = "development";
        process.env.BYPASS_AUTH_FOR_TESTING = "true";
        delete process.env.MOCK_USER_ROLE;

        const req = {
            headers: { authorization: "Bearer some-token" },
            ip: "127.0.0.1",
        } as AuthenticatedRequest;
        const res = createResponse();
        const next = jest.fn();

        await createAuthMiddleware(createClient(null) as never)(req, res, next as NextFunction);

        expect(req.user?.role).toBe("user");
    });

    it("still honors an explicitly configured MOCK_USER_ROLE (e.g. for testing admin-only routes locally)", async () => {
        dbConfig.isSupabaseOffline = true;
        process.env.NODE_ENV = "development";
        process.env.BYPASS_AUTH_FOR_TESTING = "true";
        process.env.MOCK_USER_ROLE = "admin";

        const req = {
            headers: { authorization: "Bearer some-token" },
            ip: "127.0.0.1",
        } as AuthenticatedRequest;
        const res = createResponse();
        const next = jest.fn();

        await createAuthMiddleware(createClient(null) as never)(req, res, next as NextFunction);

        expect(req.user?.role).toBe("admin");
    });

    it("does not bypass when NODE_ENV is not development, even with BYPASS_AUTH_FOR_TESTING=true and a localhost request", async () => {
        dbConfig.isSupabaseOffline = true;
        process.env.NODE_ENV = "production";
        process.env.BYPASS_AUTH_FOR_TESTING = "true";

        const req = {
            headers: { authorization: "Bearer some-token" },
            ip: "127.0.0.1",
        } as AuthenticatedRequest;
        const res = createResponse();
        const next = jest.fn();

        await createAuthMiddleware(createClient(null) as never)(req, res, next as NextFunction);

        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    it("optionalAuth also denies the bypass for non-localhost requests and proceeds without a user", async () => {
        dbConfig.isSupabaseOffline = true;
        process.env.NODE_ENV = "development";
        process.env.BYPASS_AUTH_FOR_TESTING = "true";

        const req = {
            headers: { authorization: "Bearer some-token" },
            ip: "203.0.113.42",
        } as AuthenticatedRequest;
        const res = createResponse();
        const next = jest.fn();

        await createOptionalAuthMiddleware(createClient(null) as never)(
            req,
            res,
            next as NextFunction
        );

        expect(next).toHaveBeenCalled();
        expect(req.user).toBeUndefined();
    });

    it("optionalAuth allows the bypass for localhost requests, with safe default role", async () => {
        dbConfig.isSupabaseOffline = true;
        process.env.NODE_ENV = "development";
        process.env.BYPASS_AUTH_FOR_TESTING = "true";
        delete process.env.MOCK_USER_ROLE;

        const req = {
            headers: { authorization: "Bearer some-token" },
            ip: "127.0.0.1",
        } as AuthenticatedRequest;
        const res = createResponse();
        const next = jest.fn();

        await createOptionalAuthMiddleware(createClient(null) as never)(
            req,
            res,
            next as NextFunction
        );

        expect(next).toHaveBeenCalled();
        expect(req.user?.role).toBe("user");
    });
});

describe("getUserRole", () => {
    const buildUser = (app_metadata, user_metadata): User =>
        ({
            id: "user-1",
            email: "user@example.com",
            app_metadata,
            user_metadata,
            aud: "authenticated",
            created_at: new Date().toISOString(),
        }) as User;

    it("returns 'user' when only user_metadata.role is set to admin (self-escalation attempt)", () => {
        expect(getUserRole(buildUser({}, { role: "admin" }))).toBe("user");
    });
    it("returns 'user' when only user_metadata.role is set to moderator (self-escalation attempt)", () => {
        expect(getUserRole(buildUser({}, { role: "moderator" }))).toBe("user");
    });
    it("returns 'admin' when app_metadata.role is admin, regardless of user_metadata", () => {
        expect(getUserRole(buildUser({ role: "admin" }, { role: "user" }))).toBe("admin");
    });
    it("returns 'moderator' when app_metadata.role is moderator", () => {
        expect(getUserRole(buildUser({ role: "moderator" }, {}))).toBe("moderator");
    });
    it("returns 'user' when app_metadata.role is admin but user_metadata.role conflicts (app_metadata wins, no fallback merge)", () => {
        expect(getUserRole(buildUser({ role: "user" }, { role: "admin" }))).toBe("user");
    });
    it("returns 'user' when neither app_metadata nor user_metadata has a role", () => {
        expect(getUserRole(buildUser({}, {}))).toBe("user");
    });
    it("returns 'user' when app_metadata is missing entirely and user_metadata claims admin", () => {
        const user = {
            id: "user-1",
            email: "user@example.com",
            user_metadata: { role: "admin" },
            aud: "authenticated",
            created_at: new Date().toISOString(),
        } as User;
        expect(getUserRole(user)).toBe("user");
    });
});

describe("auth middleware — privilege escalation regression (#2305)", () => {
    it("does not grant admin role for a user who self-escalated via user_metadata", async () => {
        const req = { headers: { authorization: "Bearer valid-token" } } as AuthenticatedRequest;
        const res = createResponse();
        const next = jest.fn();

        await createAuthMiddleware(
            createClient({
                id: "attacker-1",
                email: "attacker@example.com",
                app_metadata: {},
                user_metadata: { role: "admin" }, // supabase.auth.updateUser({ data: { role: "admin" } })
            }) as never
        )(req, res, next as NextFunction);

        expect(next).toHaveBeenCalled();
        expect(req.user?.role).toBe("user");

        const adminRes = createResponse();
        const adminNext = jest.fn();
        requireRole("admin")(req, adminRes, adminNext as NextFunction);

        expect(adminRes.statusCode).toBe(403);
        expect(adminNext).not.toHaveBeenCalled();
    });
});
