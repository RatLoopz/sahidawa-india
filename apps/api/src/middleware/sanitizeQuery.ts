import { Request, Response, NextFunction } from "express";
import { escapePostgrest } from "../utils/db";

/**
 * Escapes a single string value for safe PostgREST ILIKE usage.
 * escapePostgrest is a superset of escapeIlike — it escapes %, _, \, and ",
 * so there is no need to call escapeIlike separately (avoiding double-escaping).
 */
function sanitizeStringValue(value: string): string {
    return escapePostgrest(value);
}

/**
 * Recursively sanitizes all string values in an object / array.
 * Non-string primitives and nulls are left untouched.
 */
function sanitizeRecursively(obj: unknown): unknown {
    if (typeof obj === "string") {
        return sanitizeStringValue(obj);
    }
    if (Array.isArray(obj)) {
        return obj.map(sanitizeRecursively);
    }
    if (obj !== null && typeof obj === "object") {
        const sanitized: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
            sanitized[key] = sanitizeRecursively(val);
        }
        return sanitized;
    }
    return obj;
}

/**
 * Express middleware that automatically applies `escapePostgrest()` to
 * every string value in `req.query`.
 *
 * This is a defense-in-depth measure: individual route handlers should
 * still use `escapePostgrest` when building `.or()` / `.ilike()` filter
 * strings directly, but this middleware catches any query values that
 * reach the database layer unsanitized.
 *
 * **Placement:** Register this middleware *after* `express.json()` and
 * *before* route handlers.
 *
 * @example
 * ```ts
 * import { sanitizeQueryMiddleware } from "./middleware/sanitizeQuery";
 * app.use(sanitizeQueryMiddleware);
 * ```
 */
export function sanitizeQueryMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Silence unused param lint — res is required by Express middleware signature
    void res;
    if (req.query && typeof req.query === "object") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any).query = sanitizeRecursively(req.query) as Record<string, unknown>;
    }
    next();
}
