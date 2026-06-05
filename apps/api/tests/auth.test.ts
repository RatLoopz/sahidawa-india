import { NextFunction, Response } from "express";
import { AuthenticatedRequest, createAuthMiddleware, requireRole } from "../src/middleware/auth";

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
