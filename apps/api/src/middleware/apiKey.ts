import { NextFunction, Request, Response } from "express";

/**
 * API key middleware for public-facing endpoints.
 *
 * Validates the `x-api-key` header against a list of allowed keys
 * configured via the `API_KEYS` environment variable (comma-separated).
 * If no `API_KEYS` are configured, the middleware falls back to allowing
 * all requests (backward-compatible with local dev / zero-config deploys).
 *
 * Requests from known frontend origins (CORS-allowed) are also accepted
 * without an API key — the origin is already validated by the CORS
 * middleware, so a browser session from the official frontend is trusted.
 *
 * All other requests MUST present a valid `x-api-key` header.
 */

const KNOWN_FRONTEND_PATHS = new Set([
    "/api/verify",
    "/api/verify/batch",
]);

/**
 * Returns the set of allowed API keys parsed from environment.
 * Returns an empty set when `API_KEYS` is not configured.
 */
function getAllowedKeys(): Set<string> {
    const raw = process.env.API_KEYS;
    if (!raw) return new Set();
    return new Set(
        raw
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean)
    );
}

/**
 * Checks whether the request originated from a known frontend origin
 * that was already approved by the CORS middleware.
 */
function isFromTrustedOrigin(req: Request): boolean {
    const origin = req.headers.origin;
    if (!origin) return false;

    // Reuse the same logic as cors.ts: check against ALLOWED_ORIGINS and FRONTEND_URL
    const allowedOrigins = new Set<string>([
        "http://localhost:3000",
        "http://localhost:4000",
        "http://localhost:8000",
    ]);

    const envOrigins = process.env.ALLOWED_ORIGINS;
    if (envOrigins) {
        envOrigins.split(",").forEach((o) => allowedOrigins.add(o.trim()));
    }

    const frontendUrl = process.env.FRONTEND_URL;
    if (frontendUrl) {
        frontendUrl.split(",").forEach((o) => allowedOrigins.add(o.trim()));
    }

    return allowedOrigins.has(origin);
}

/**
 * Express middleware that requires a valid `x-api-key` header unless
 * the request comes from a trusted browser origin.
 */
export function requireApiKey(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    const allowedKeys = getAllowedKeys();

    // No keys configured → open access (backward-compatible)
    if (allowedKeys.size === 0) {
        next();
        return;
    }

    // Trusted browser origin → already gated by CORS
    if (isFromTrustedOrigin(req)) {
        next();
        return;
    }

    const apiKey = req.headers["x-api-key"];
    if (typeof apiKey !== "string" || !allowedKeys.has(apiKey)) {
        res.status(401).json({
            error: "Unauthorized",
            message:
                "A valid x-api-key header is required. Obtain an API key from the SahiDawa dashboard.",
        });
        return;
    }

    next();
}
