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

const getUserRole = (user: User): AuthRole => {
    // Read role from app_metadata (server-controlled, cannot be set by user).
    // app_metadata takes precedence; user_metadata is accepted as a fallback
    // only for legacy compatibility during the transition period.
    const metadataRole = user.app_metadata?.role || user.user_metadata?.role;
    if (metadataRole === "admin") return "admin";
    if (metadataRole === "moderator") return "moderator";
    return "user";
};

/**
 * Extract token from HTTP-only cookie (preferred) or Authorization header (fallback).
 * The fallback supports clients that haven't migrated to cookie-based auth yet.
 */
const extractToken = (req: Request): string | null => {
    if (req.cookies?.access_token) {
        return req.cookies.access_token;
    }
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
        return authHeader.slice(7);
    }
    return null;
};

export const createAuthMiddleware =
    (client: SupabaseAuthClient = supabase) =>
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const token = extractToken(req);

        if (!token) {
            res.status(401).json({ error: "Unauthorized: Missing access token" });
            return;
        }

        const { data, error } = await client.auth.getUser(token);

        if (error || !data.user) {
            res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
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
        const token = extractToken(req);

        if (!token) {
            return next();
        }

        const { data, error } = await client.auth.getUser(token);

        if (error || !data.user) {
            res.status(401).json({
                error: "Unauthorized: Invalid or expired token",
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