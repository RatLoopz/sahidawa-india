import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { getDbErrorStatus, getDbErrorMessage } from "../utils/dbErrors";
import { getRequestId } from "./requestId";
import { sanitize } from "../utils/security/sanitize";
import { ApiError } from "../utils/apiError";

// Error category classification for structured logging
function getErrorCategory(statusCode: number): string {
    if (statusCode >= 500) return "server";
    if (statusCode === 401 || statusCode === 403) return "auth";
    if (statusCode === 404) return "not_found";
    if (statusCode === 422) return "validation";
    if (statusCode === 429) return "rate_limit";
    if (statusCode >= 400) return "client";
    return "unknown";
}

function getClientMessage(err: Error & { code?: string }, statusCode: number): string {
    if (statusCode >= 500) return "Internal Server Error";
    if (err.code) {
        const dbMessage = getDbErrorMessage(err.code);
        if (dbMessage) return dbMessage;
        if (/^[0-9A-Z]{5}$/.test(err.code)) {
            return "A database error occurred.";
        }
    }
    const messages: Record<number, string> = {
        400: "The request could not be processed. Please check your input.",
        401: "Unauthorized. Please sign in to continue.",
        403: "Forbidden. You do not have permission to perform this action.",
        404: "The requested resource was not found.",
        405: "Method not allowed.",
        409: "A conflict occurred. Please try again.",
        410: "The requested resource is no longer available.",
        415: "Unsupported media type.",
        422: "The request could not be processed due to invalid data.",
        429: "Too many requests. Please try again later.",
    };
    return (err.message || messages[statusCode]) ?? "An unexpected error occurred.";
}

export function errorHandler(
    err: Error & { statusCode?: number; status?: number; code?: string },
    req: Request,
    res: Response,
    _next: NextFunction
): void {
    let statusCode = err.statusCode || err.status || 500;

    // Check if this is an ApiError (typed error with code and retryable flag)
    const isApiError = err instanceof ApiError;
    const errorCode = isApiError ? err.code : undefined;
    const retryable = isApiError ? err.retryable : false;

    if (!isApiError && err.code) {
        const dbStatus = getDbErrorStatus(err.code);
        if (dbStatus) {
            statusCode = dbStatus;
        }
    }

    const level = statusCode >= 500 ? "error" : "warn";
    const requestId = getRequestId();
    const errorCategory = getErrorCategory(statusCode);

    // Structured log entry with all metadata
    logger.log({
        level,
        message: `${req.method} ${req.originalUrl} - ${err.message}`,
        statusCode,
        error_code: errorCode,
        error_category: errorCategory,
        retryable,
        stack: err.stack,
        body: req.body ? sanitize(req.body as Record<string, unknown>) : undefined,
        query: req.query,
        params: req.params,
        ...(requestId && { requestId }),
    });

    const isProduction = process.env.NODE_ENV === "production";
    const clientMessage = getClientMessage(err, statusCode);

    res.status(statusCode).json({
        success: false,
        error: {
            code: errorCode || getErrorCategory(statusCode).toUpperCase(),
            message: clientMessage,
            retryable,
            ...(!isProduction && { stack: err.stack }),
        },
        ...(requestId && { requestId }),
    });
}
