import { Router, Request, Response } from "express";
import { supabase } from "../db/client";
import {
    generateTokenPair,
    rotateRefreshToken,
    revokeRefreshToken,
    verifyAccessToken,
    REFRESH_TOKEN_TTL_S,
} from "../services/auth";
import logger from "../utils/logger";

const router = Router();

const REFRESH_COOKIE = "sahidawa_refresh_token";

const refreshCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/api/auth/refresh",
    maxAge: REFRESH_TOKEN_TTL_S * 1000,
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
// Exchange Supabase session token for our own access + refresh token pair.
/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Login and receive access + refresh tokens
 *     description: >
 *       Validates a Supabase bearer token, then issues a short-lived access token
 *       (15 min) and sets a 7-day HTTP-only refresh token cookie.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - supabaseToken
 *             properties:
 *               supabaseToken:
 *                 type: string
 *                 description: Valid Supabase session access token
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 expiresIn:
 *                   type: number
 *                   example: 900
 *       401:
 *         description: Invalid Supabase token
 *       500:
 *         description: Server error
 */
router.post("/login", async (req: Request, res: Response) => {
    const { supabaseToken } = req.body;

    if (!supabaseToken || typeof supabaseToken !== "string") {
        res.status(400).json({ error: "supabaseToken is required" });
        return;
    }

    const { data, error } = await supabase.auth.getUser(supabaseToken);

    if (error || !data.user) {
        res.status(401).json({ error: "Invalid or expired Supabase token" });
        return;
    }

    const user = data.user;
    const role = user.app_metadata?.role || user.user_metadata?.role || "user";

    const tokenPair = generateTokenPair({
        sub: user.id,
        email: user.email,
        role,
    });

    // Set refresh token in HTTP-only cookie
    res.cookie(REFRESH_COOKIE, tokenPair.refreshToken, refreshCookieOptions);

    logger.info(`User ${user.id} logged in, tokens issued`);

    res.status(200).json({
        accessToken: tokenPair.accessToken,
        expiresIn: 900, // 15 minutes in seconds
    });
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
// Rotate the refresh token and return a fresh access token.
/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Rotate refresh token and get a new access token
 *     description: >
 *       Reads the HTTP-only refresh token cookie, validates it, revokes it,
 *       and issues a new access token + rotated refresh token cookie.
 *       Call this automatically when the access token expires (401 response).
 *     responses:
 *       200:
 *         description: Token rotation successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 expiresIn:
 *                   type: number
 *                   example: 900
 *       401:
 *         description: Refresh token missing, invalid, or expired
 */
router.post("/refresh", (req: Request, res: Response) => {
    const oldRefreshToken = req.cookies?.[REFRESH_COOKIE];

    if (!oldRefreshToken) {
        res.status(401).json({ error: "Refresh token not found" });
        return;
    }

    const tokenPair = rotateRefreshToken(oldRefreshToken);

    if (!tokenPair) {
        // Clear the invalid cookie
        res.clearCookie(REFRESH_COOKIE, { path: "/api/auth/refresh" });
        res.status(401).json({ error: "Refresh token is invalid or expired. Please log in again." });
        return;
    }

    // Set new rotated refresh token cookie
    res.cookie(REFRESH_COOKIE, tokenPair.refreshToken, refreshCookieOptions);

    logger.info("Refresh token rotated successfully");

    res.status(200).json({
        accessToken: tokenPair.accessToken,
        expiresIn: 900,
    });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Logout and revoke refresh token
 *     description: Revokes the HTTP-only refresh token cookie and clears the session.
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post("/logout", (req: Request, res: Response) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];

    if (refreshToken) {
        revokeRefreshToken(refreshToken);
    }

    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth/refresh" });
    logger.info("User logged out, refresh token revoked");
    res.status(200).json({ message: "Logged out successfully" });
});

export default router;