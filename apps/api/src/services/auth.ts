import jwt from "jsonwebtoken";
import crypto from "crypto";
import logger from "../utils/logger";

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_S = 7 * 24 * 60 * 60;

const getJwtSecret = (): string => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET environment variable is not set");
    }
    return secret;
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TokenPayload {
    sub: string;       // user id
    email?: string;
    role: string;
}

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    refreshTokenExpiresAt: Date;
}

// ── In-memory refresh token store ─────────────────────────────────────────────
// In production this should be replaced with Redis or a DB table.
// Structure: Map<refreshToken, { userId, expiresAt }>

interface RefreshTokenRecord {
    userId: string;
    email?: string;
    role: string;
    expiresAt: Date;
}

const refreshTokenStore = new Map<string, RefreshTokenRecord>();

// Clean up expired tokens periodically (every hour)
setInterval(() => {
    const now = new Date();
    let cleaned = 0;
    for (const [token, record] of refreshTokenStore.entries()) {
        if (record.expiresAt < now) {
            refreshTokenStore.delete(token);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        logger.info(`Token cleanup: removed ${cleaned} expired refresh token(s)`);
    }
}, 60 * 60 * 1000);

// ── Token generation ──────────────────────────────────────────────────────────

/**
 * Generate a short-lived access token (15 minutes).
 */
export const generateAccessToken = (payload: TokenPayload): string => {
    return jwt.sign(
        { sub: payload.sub, email: payload.email, role: payload.role },
        getJwtSecret(),
        { expiresIn: ACCESS_TOKEN_TTL }
    );
};

/**
 * Generate a secure random refresh token (7 days) and store it.
 */
export const generateRefreshToken = (payload: TokenPayload): { token: string; expiresAt: Date } => {
    const token = crypto.randomBytes(64).toString("hex");
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    refreshTokenStore.set(token, {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
        expiresAt,
    });

    logger.info(`Refresh token issued for user ${payload.sub}`);
    return { token, expiresAt };
};

/**
 * Generate both access and refresh tokens in one call.
 */
export const generateTokenPair = (payload: TokenPayload): TokenPair => {
    const accessToken = generateAccessToken(payload);
    const { token: refreshToken, expiresAt } = generateRefreshToken(payload);

    return {
        accessToken,
        refreshToken,
        refreshTokenExpiresAt: expiresAt,
    };
};

/**
 * Verify an access token. Returns payload or throws.
 */
export const verifyAccessToken = (token: string): TokenPayload => {
    const decoded = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload;
    return {
        sub: decoded.sub as string,
        email: decoded.email,
        role: decoded.role,
    };
};

/**
 * Rotate a refresh token — validates the old one, revokes it, and issues a new pair.
 * Returns null if the refresh token is invalid or expired.
 */
export const rotateRefreshToken = (
    oldRefreshToken: string
): TokenPair | null => {
    const record = refreshTokenStore.get(oldRefreshToken);

    if (!record) {
        logger.warn("Refresh token rotation failed: token not found");
        return null;
    }

    if (record.expiresAt < new Date()) {
        refreshTokenStore.delete(oldRefreshToken);
        logger.warn(`Refresh token rotation failed: token expired for user ${record.userId}`);
        return null;
    }

    // Revoke old token immediately (rotation)
    refreshTokenStore.delete(oldRefreshToken);
    logger.info(`Refresh token rotated for user ${record.userId}`);

    return generateTokenPair({
        sub: record.userId,
        email: record.email,
        role: record.role,
    });
};

/**
 * Revoke a specific refresh token (logout).
 */
export const revokeRefreshToken = (token: string): boolean => {
    const existed = refreshTokenStore.has(token);
    refreshTokenStore.delete(token);
    return existed;
};

export { REFRESH_TOKEN_TTL_S };