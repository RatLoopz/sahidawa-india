import { NextFunction, Request, Response } from "express";
import { SupabaseClient, User } from "@supabase/supabase-js";
import { supabase } from "../db/client";

export type AuthRole = "user" | "admin" | "moderator";

export interface AuthenticatedUser {
    id: string;
    email?: string;
    role: AuthRole;
    raw: User;
}

export interface AuthenticatedRequest extends Request {
    user?: AuthenticatedUser;
}

type SupabaseAuthClient = Pick<SupabaseClient, "auth">;

const getBearerToken = (authorization?: string): string | null => {
    if (!authorization) {
        return null;
    }

    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
        return null;
    }

    return token;
};

const getUserRole = (user: User): AuthRole => {
    const metadataRole = user.app_metadata?.role || user.user_metadata?.role;
    if (metadataRole === "admin") return "admin";
    if (metadataRole === "moderator") return "moderator";
    return "user";
};

export const createAuthMiddleware =
    (client: SupabaseAuthClient = supabase) =>
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const token = getBearerToken(req.headers.authorization);

        if (!token) {
            res.status(401).json({ error: "Authorization bearer token is required" });
            return;
        }

        const { data, error } = await client.auth.getUser(token);

        if (error || !data.user) {
            res.status(401).json({ error: "Invalid or expired authentication token" });
            return;
        }

        req.user = {
            id: data.user.id,
            email: data.user.email,
            role: getUserRole(data.user),
            raw: data.user,
        };

        next();
    };

export const requireAuth = createAuthMiddleware();

export const createOptionalAuthMiddleware =
    (client: SupabaseAuthClient = supabase) =>
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        // No Authorization header → anonymous flow (citizens without accounts).
        if (!req.headers.authorization) {
            return next();
        }

        const token = getBearerToken(req.headers.authorization);

        // Header present but malformed: fail loud rather than silently dropping
        // attribution. A signed-in user with a corrupted header should re-auth,
        // not have the report anonymized and disappear from /reports/me.
        if (!token) {
            res.status(401).json({
                error: 'Malformed Authorization header — expected "Bearer <token>"',
            });
            return;
        }

        const { data, error } = await client.auth.getUser(token);

        // Token present but Supabase rejected it (expired/invalid/revoked).
        // Same reasoning: preserve attribution by forcing re-auth.
        if (error || !data.user) {
            res.status(401).json({
                error: "Invalid or expired authentication token",
            });
            return;
        }

        req.user = {
            id: data.user.id,
            email: data.user.email,
            role: getUserRole(data.user),
            raw: data.user,
        };

        next();
    };

export const optionalAuth = createOptionalAuthMiddleware();

export const requireRole =
    (...allowedRoles: AuthRole[]) =>
    (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            res.status(401).json({ error: "Authentication is required" });
            return;
        }

        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({ error: "Insufficient permissions" });
            return;
        }

        next();
    };
