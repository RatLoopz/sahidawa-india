import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { getDbErrorStatus, getDbErrorMessage } from "../utils/dbErrors";
import { getRequestId } from "./requestId";

import { sanitize } from "../utils/security/sanitize";

const GENERIC_CLIENT_MESSAGES: Record<number, string> = {
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

function getClientMessage(err: Error & { code?: string }, statusCode: number): string {
    if (statusCode >= 500) return "Internal Server Error";
    const dbMessage = err.code ? getDbErrorMessage(err.code) : null;
    if (dbMessage) return dbMessage;
    return GENERIC_CLIENT_MESSAGES[statusCode] ?? "An unexpected error occurred.";
}

export function errorHandler(
    err: Error & { statusCode?: number; status?: number; code?: string },
    req: Request,
    res: Response,
    _next: NextFunction
): void {
    let statusCode = err.statusCode || err.status || 500;

    if (err.code) {
        const dbStatus = getDbErrorStatus(err.code);
        if (dbStatus) {
            statusCode = dbStatus;
        }
    }

    const level = statusCode >= 500 ? "error" : "warn";

    const requestId = getRequestId();

    logger.log({
        level,
        message: `${req.method} ${req.originalUrl} - ${err.message}`,
        statusCode,
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
            message: clientMessage,
            ...(!isProduction && { stack: err.stack }),
        },
        ...(requestId && { requestId }),
    });
}
