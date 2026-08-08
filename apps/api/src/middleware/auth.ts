import { NextFunction, Request, Response } from "express";
import crypto from "crypto";
import { SupabaseClient, User } from "@supabase/supabase-js";
import { supabase, dbConfig } from "../db/client";
import logger from "../utils/logger";
import { redisClient } from "../utils/redis";
import { isSupabaseConnectionError } from "../utils/withDbFallback";

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
 * machine — env vars can leak into a deploy, but the actual TCP connection
 * address (req.socket.remoteAddress) can't be spoofed by HTTP headers.
 */
const LOCALHOST_IPS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

const isLocalhostRequest = (req: Request): boolean => {
    const addr = req.socket?.remoteAddress ?? req.ip ?? "";
    return LOCALHOST_IPS.has(addr);
};

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
            ip: req.socket?.remoteAddress,
            forwardedFor: req.ip,
        });
        return false;
    }

    logger.warn(
        "SECURITY WARNING: AUTH BYPASS ACTIVE — request authenticated via BYPASS_AUTH_FOR_TESTING mock user. This must never happen outside local development."
    );
    return true;
};

async function clearAuthCache(cacheKey: string, context: string): Promise<void> {
    try {
        if (redisClient.isOpen) {
            await redisClient.del(cacheKey);
        }
    } catch (err) {
        logger.warn({
            message: `Redis cache del error in ${context}`,
            error: String(err),
        });
    }
}

async function readAuthCache(cacheKey: string, context: string): Promise<AuthenticatedUser | null> {
    try {
        if (redisClient.isOpen) {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                return JSON.parse(cached) as AuthenticatedUser;
            }
        }
    } catch (err) {
        logger.warn({
            message: `Redis cache get error in ${context}`,
            error: String(err),
        });
    }
    return null;
}

async function writeAuthCache(
    cacheKey: string,
    user: AuthenticatedUser,
    context: string
): Promise<void> {
    try {
        if (redisClient.isOpen) {
            await redisClient.setEx(cacheKey, 30, JSON.stringify(user));
        }
    } catch (err) {
        logger.warn({
            message: `Redis cache set error in ${context}`,
            error: String(err),
        });
    }
}

/**
 * Shared auth path for required and optional middleware.
 * Returns true when the request should continue via next().
 */
async function authenticateRequest(
    req: AuthenticatedRequest,
    res: Response,
    client: SupabaseAuthClient,
    required: boolean
): Promise<boolean> {
    const token = extractToken(req);
    const cacheContext = required ? "requireAuth" : "optionalAuth";

    if (!token) {
        if (required) {
            res.status(401).json({ error: "Unauthorized: Missing access token" });
            return false;
        }
        return true;
    }

    if (dbConfig?.isSupabaseOffline) {
        if (canUseAuthBypass(req)) {
            req.user = getMockUser();
        } else if (required) {
            res.status(401).json({ error: "Unauthorized: Authentication service is offline" });
            return false;
        }
        return true;
    }

    const cacheKey = `auth:user:${crypto.createHash("sha256").update(token).digest("hex")}`;

    try {
        const { data, error } = await client.auth.getUser(token);

        if (error) {
            if (isSupabaseConnectionError(error.message)) {
                const cachedUser = await readAuthCache(
                    cacheKey,
                    `${cacheContext} middleware fallback`
                );
                if (cachedUser) {
                    req.user = cachedUser;
                    return true;
                }

                if (dbConfig) dbConfig.setOffline();
                logger.warn({
                    message: "Supabase auth server returned connection error.",
                    error: error.message,
                });
                if (canUseAuthBypass(req)) {
                    req.user = getMockUser();
                    return true;
                }
                if (!required) {
                    return true;
                }
                // required + no bypass: same as invalid token path below
            }

            await clearAuthCache(cacheKey, `${cacheContext} (token error)`);
            res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
            return false;
        }

        if (!data.user) {
            await clearAuthCache(cacheKey, `${cacheContext} (no user)`);
            res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
            return false;
        }

        req.user = {
            id: data.user.id,
            email: data.user.email,
            role: getUserRole(data.user),
            raw: data.user,
        };

        await writeAuthCache(cacheKey, req.user, `${cacheContext} middleware`);
        return true;
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (isSupabaseConnectionError(errMsg)) {
            if (dbConfig) dbConfig.setOffline();
        }

        logger.warn({
            message: required
                ? "Supabase auth server request failed."
                : "Supabase optional auth server request failed.",
            error: errMsg,
        });

        if (canUseAuthBypass(req)) {
            req.user = getMockUser();
            return true;
        }
        if (required) {
            res.status(401).json({
                error: "Unauthorized: Authentication service unavailable",
            });
            return false;
        }
        return true;
    }
}

export const createAuthMiddleware =
    (client: SupabaseAuthClient = supabase) =>
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (await authenticateRequest(req, res, client, true)) {
            next();
        }
    };

export const requireAuth = createAuthMiddleware();

export const createOptionalAuthMiddleware =
    (client: SupabaseAuthClient = supabase) =>
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (await authenticateRequest(req, res, client, false)) {
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
