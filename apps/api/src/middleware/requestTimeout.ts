import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { getRequestId } from "./requestId";

/**
 * Default request timeout in milliseconds (30 seconds).
 * Prevents clients from holding connections open indefinitely,
 * which can exhaust server resources under load.
 */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Express middleware that sets a timeout on every inbound request.
 *
 * If the handler does not finish (and call `res.end()` / `res.send()` /
 * `res.json()`) within the timeout window, the connection is destroyed
 * and a 504 Gateway Timeout is logged.
 *
 * The timeout is cleared automatically when the response finishes, so
 * well-behaved requests are never affected.
 *
 * @param timeoutMs - Timeout in milliseconds (default 30 000).
 *
 * @example
 * ```ts
 * import { requestTimeout } from "./middleware/requestTimeout";
 * app.use(requestTimeout());         // 30 s default
 * app.use(requestTimeout(10_000));   // 10 s custom
 * ```
 */
export function requestTimeout(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    return (req: Request, res: Response, next: NextFunction): void => {
        // Guard: req.socket can be undefined in edge cases (aborted connections)
        if (!req.socket) {
            next();
            return;
        }

        // Set a server-side socket timeout — if the handler hasn't finished
        // within the window, we destroy the socket and log the event.
        req.socket.setTimeout(timeoutMs);

        const onTimeout = () => {
            logger.warn("Request timed out", {
                method: req.method,
                url: req.originalUrl,
                timeoutMs,
            });
            // If headers haven't been sent yet, return a 504.
            if (!res.headersSent) {
                const requestId = getRequestId();
                res.status(504).json({
                    error: "Request timed out",
                    ...(requestId && { requestId }),
                });
            }
        };

        req.socket.on("timeout", onTimeout);

        // Clean up the listener when the response finishes to avoid
        // memory leaks across the socket pool.
        res.on("finish", () => {
            req.socket.removeListener("timeout", onTimeout);
            // Reset to the Node.js default (0 = no timeout) so the socket
            // can be safely returned to the keep-alive pool.
            req.socket.setTimeout(0);
        });

        next();
    };
}
