import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

/**
 * HTTPS Redirect Middleware
 *
 * Enforces HTTPS in non-development environments to protect sensitive healthcare data
 * (medicine verification details, user authentication, etc.) from plaintext interception.
 *
 * In production, redirects HTTP requests to HTTPS using a 308 (permanent, preserves method) redirect.
 * Development and test environments bypass this check to allow local testing.
 *
 * Related: Issue #2687 - Application does not enforce HTTPS
 */
export const httpsRedirect = (req: Request, res: Response, next: NextFunction): void => {
    // Skip HTTPS enforcement in development and test environments
    if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
        return next();
    }

    // Check if request came through a secure connection
    // When behind a reverse proxy (Nginx), check X-Forwarded-Proto header
    // which indicates the original client request protocol
    const isSecure =
        req.protocol === "https" || req.get("X-Forwarded-Proto") === "https" || req.secure;

    if (!isSecure) {
        logger.warn("HTTP request intercepted in non-development environment", {
            method: req.method,
            path: req.path,
            remoteIp: req.ip,
        });

        // Redirect to HTTPS using the same host and path
        const host = req.get("host") || "localhost";
        const redirectUrl = `https://${host}${req.originalUrl}`;

        return res.redirect(308, redirectUrl);
    }

    next();
};
