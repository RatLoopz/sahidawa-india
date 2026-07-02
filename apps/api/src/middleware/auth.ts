import { NextFunction, Request, Response } from "express";
import { SupabaseClient, User } from "@supabase/supabase-js";
import { supabase, dbConfig } from "../db/client";
import logger from "../utils/logger";
import { redisClient } from "../utils/redis";

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

export const getUserRole = (user: User): AuthRole => {
    const metadataRole = user.app_metadata?.role;
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

const getMockUser = (): AuthenticatedUser => {
    // SECURITY: default is "user", never "admin" — an unset MOCK_USER_ROLE
    // must never silently grant elevated privileges, even in the legitimate
    // local-dev bypass case.
    const mockRole = (process.env.MOCK_USER_ROLE as AuthRole) || "user";
    return {
        id: process.env.MOCK_USER_ID || "mock-user-id",
        email: process.env.MOCK_USER_EMAIL || "mock@sahidawa.local",
        role: mockRole,
        raw: {
            id: process.env.MOCK_USER_ID || "mock-user-id",
            email: process.env.MOCK_USER_EMAIL || "mock@sahidawa.local",
            app_metadata: { role: mockRole },
            user_metadata: {},
            aud: "authenticated",
            created_at: new Date().toISOString(),
        } as User,
    };
};

/**
 * SECURITY: The auth bypass (BYPASS_AUTH_FOR_TESTING) exists only to let a
 * developer keep working against a local API when their local Supabase is
 * offline. It must never be reachable from anywhere but the developer's own
 * machine — env vars can leak into a deploy, but request origin can't be
 * spoofed by a misconfigured .env alone.
 */
const LOCALHOST_IPS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

const isLocalhostRequest = (req: Request): boolean => LOCALHOST_IPS.has(req.ip ?? "");

/**
 * Returns true only when every condition required to use the local-dev auth
 * bypass is satisfied: explicit opt-in env var, development environment, and
 * the request physically originating from localhost. Logs a visible warning
 * the moment the bypass is about to be used so it's never silently active.
 */
const canUseAuthBypass = (req: Request): boolean => {
    if (process.env.NODE_ENV !== "development" || process.env.BYPASS_AUTH_FOR_TESTING !== "true") {
        return false;
    }

    if (!isLocalhostRequest(req)) {
        logger.warn({
            message:
                "Auth bypass env vars are set but request did not originate from localhost — bypass denied.",
            ip: req.ip,
        });
        return false;
    }

    logger.warn(
        "SECURITY WARNING: AUTH BYPASS ACTIVE — request authenticated via BYPASS_AUTH_FOR_TESTING mock user. This must never happen outside local development."
    );
    return true;
};

export const createAuthMiddleware =
    (client: SupabaseAuthClient = supabase) =>
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const token = extractToken(req);

        if (!token) {
            res.status(401).json({ error: "Unauthorized: Missing access token" });
            return;
        }

        if (dbConfig?.isSupabaseOffline) {
            if (canUseAuthBypass(req)) {
                req.user = getMockUser();
                next();
            } else {
                res.status(401).json({ error: "Unauthorized: Authentication service is offline" });
            }
            return;
        }

        const cacheKey = `auth:user:${token.slice(-16)}`;
        try {
            if (redisClient.isOpen) {
                const cached = await redisClient.get(cacheKey);
                if (cached) {
                    req.user = JSON.parse(cached);
                    next();
                    return;
                }
            }
        } catch (err) {
            logger.warn({
                message: "Redis cache get error in auth middleware",
                error: String(err),
            });
        }

        try {
            const { data, error } = await client.auth.getUser(token);

            if (error) {
                const isConnectionError =
                    error.message?.includes("fetch failed") ||
                    error.message?.includes("timeout") ||
                    error.message?.includes("connect") ||
                    error.message?.includes("refused");

                if (isConnectionError) {
                    if (dbConfig) dbConfig.setOffline();
                    logger.warn({
                        message: "Supabase auth server returned connection error.",
                        error: error.message,
                    });
                    if (canUseAuthBypass(req)) {
                        req.user = getMockUser();
                        next();
                        return;
                    }
                }

                res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
                return;
            }

            if (!data.user) {
                res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
                return;
            }

            req.user = {
                id: data.user.id,
                email: data.user.email,
                role: getUserRole(data.user),
                raw: data.user,
            };

            try {
                if (redisClient.isOpen) {
                    await redisClient.setEx(cacheKey, 300, JSON.stringify(req.user));
                }
            } catch (err) {
                logger.warn({
                    message: "Redis cache set error in auth middleware",
                    error: String(err),
                });
            }

            next();
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            if (
                errMsg.includes("fetch failed") ||
                errMsg.includes("refused") ||
                errMsg.includes("timeout")
            ) {
                if (dbConfig) dbConfig.setOffline();
            }

            logger.warn({
                message: "Supabase auth server request failed.",
                error: errMsg,
            });

            if (canUseAuthBypass(req)) {
                req.user = getMockUser();
                next();
            } else {
                res.status(401).json({
                    error: "Unauthorized: Authentication service unavailable",
                });
            }
        }
    };

export const requireAuth = createAuthMiddleware();

export const createOptionalAuthMiddleware =
    (client: SupabaseAuthClient = supabase) =>
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const token = extractToken(req);

        if (!token) {
            return next();
        }

        if (dbConfig?.isSupabaseOffline) {
            if (canUseAuthBypass(req)) {
                req.user = getMockUser();
            }
            return next();
        }

        const cacheKey = `auth:user:${token.slice(-16)}`;
        try {
            if (redisClient.isOpen) {
                const cached = await redisClient.get(cacheKey);
                if (cached) {
                    req.user = JSON.parse(cached);
                    next();
                    return;
                }
            }
        } catch (err) {
            logger.warn({
                message: "Redis cache get error in optional auth middleware",
                error: String(err),
            });
        }

        try {
            const { data, error } = await client.auth.getUser(token);

            if (error) {
                const isConnectionError =
                    error.message?.includes("fetch failed") ||
                    error.message?.includes("timeout") ||
                    error.message?.includes("connect") ||
                    error.message?.includes("refused");

                if (isConnectionError) {
                    if (dbConfig) dbConfig.setOffline();
                    logger.warn({
                        message: "Supabase auth server returned connection error.",
                        error: error.message,
                    });
                    if (canUseAuthBypass(req)) {
                        req.user = getMockUser();
                    }
                    next();
                    return;
                }

                res.status(401).json({
                    error: "Unauthorized: Invalid or expired token",
                });
                return;
            }

            if (!data.user) {
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

            try {
                if (redisClient.isOpen) {
                    await redisClient.setEx(cacheKey, 300, JSON.stringify(req.user));
                }
            } catch (err) {
                logger.warn({
                    message: "Redis cache set error in optional auth middleware",
                    error: String(err),
                });
            }

            next();
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            if (
                errMsg.includes("fetch failed") ||
                errMsg.includes("refused") ||
                errMsg.includes("timeout")
            ) {
                if (dbConfig) dbConfig.setOffline();
            }

            logger.warn({
                message: "Supabase optional auth server request failed.",
                error: errMsg,
            });

            if (canUseAuthBypass(req)) {
                req.user = getMockUser();
            }
            next();
        }
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
