/**
 * Typed API error classes for standardized error handling.
 *
 * Usage in routes:
 *   throw new ApiError(404, 'Medicine not found', { code: 'MEDICINE_NOT_FOUND' });
 *   throw new ApiError(429, 'Rate limit exceeded', { code: 'RATE_LIMITED', retryable: true });
 *   throw new ApiError(502, 'ML service unavailable', { code: 'ML_SERVICE_DOWN', retryable: true });
 */

export interface ApiErrorOptions {
    /** Machine-readable error code (e.g., 'MEDICINE_NOT_FOUND') */
    code: string;
    /** Whether the client should retry this request */
    retryable?: boolean;
    /** Additional context about the error (not exposed to clients in production) */
    details?: unknown;
}

export class ApiError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly retryable: boolean;
    public readonly details?: unknown;

    constructor(statusCode: number, message: string, options: ApiErrorOptions) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.code = options.code;
        this.retryable = options.retryable ?? false;
        this.details = options.details;
    }
}

// ── Pre-defined common errors ────────────────────────────────────────────────

export class NotFoundError extends ApiError {
    constructor(resource: string, details?: unknown) {
        super(404, `${resource} not found`, {
            code: 'NOT_FOUND',
            retryable: false,
            details,
        });
    }
}

export class ValidationError extends ApiError {
    constructor(message: string, details?: unknown) {
        super(422, message, {
            code: 'VALIDATION_ERROR',
            retryable: false,
            details,
        });
    }
}

export class UnauthorizedError extends ApiError {
    constructor(message = 'Unauthorized') {
        super(401, message, {
            code: 'UNAUTHORIZED',
            retryable: false,
        });
    }
}

export class ForbiddenError extends ApiError {
    constructor(message = 'Forbidden') {
        super(403, message, {
            code: 'FORBIDDEN',
            retryable: false,
        });
    }
}

export class ConflictError extends ApiError {
    constructor(message: string, details?: unknown) {
        super(409, message, {
            code: 'CONFLICT',
            retryable: false,
            details,
        });
    }
}

export class RateLimitError extends ApiError {
    constructor(message = 'Too many requests') {
        super(429, message, {
            code: 'RATE_LIMITED',
            retryable: true,
        });
    }
}

export class ServiceUnavailableError extends ApiError {
    constructor(serviceName: string, details?: unknown) {
        super(503, `${serviceName} is currently unavailable`, {
            code: 'SERVICE_UNAVAILABLE',
            retryable: true,
            details,
        });
    }
}

export class InternalError extends ApiError {
    constructor(message = 'Internal Server Error', details?: unknown) {
        super(500, message, {
            code: 'INTERNAL_ERROR',
            retryable: false,
            details,
        });
    }
}
