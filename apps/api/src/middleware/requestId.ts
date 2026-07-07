import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { AsyncLocalStorage } from "async_hooks";

// ── Request Context (AsyncLocalStorage) ────────────────────────────────────
// Stores per-request metadata so any downstream code

interface RequestContext {
   
    requestId: string;
}

const requestContext = new AsyncLocalStorage<RequestContext>();

// ── Public helpers ─────────────────────────────────────────────────────────

/**
 * Returns the `x-request-id` for the currently-executing request, or
 * `undefined` when called outside a request context
 */
export function getRequestId(): string | undefined {
    return requestContext.getStore()?.requestId;
}

// ── Middleware ──────────────────────────────────────────────────────────────

const REQUEST_ID_HEADER = "x-request-id";

/**
 * Express middleware
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
    const id =
        (typeof req.headers[REQUEST_ID_HEADER] === "string" && req.headers[REQUEST_ID_HEADER]) ||
        crypto.randomUUID();

    // Attach to the request object for direct access in handlers
    (req as Request & { requestId: string }).requestId = id;

    // Echo the correlation ID back in the response headers
    res.setHeader(REQUEST_ID_HEADER, id);

    // Run the remainder of the middleware stack inside an AsyncLocalStorage
    // context so getRequestId() works everywhere downstream.
    requestContext.run({ requestId: id }, () => {
        next();
    });
}

export { REQUEST_ID_HEADER };
