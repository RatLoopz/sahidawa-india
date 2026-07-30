import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { getRequestId } from "./requestId";

/**
 * Standardised error response shape returned by validateRequest.
 */
interface ValidationErrorResponse {
    error: string;
    details: z.ZodIssue[];
    requestId?: string;
}

/**
 * Options for the validateRequest middleware factory.
 * At least one of body, query, or params must be provided.
 */
export interface ValidateRequestOptions {
    /** Zod schema to validate req.body against. */
    body?: z.ZodType<unknown>;
    /** Zod schema to validate req.query against. */
    query?: z.ZodType<unknown>;
    /** Zod schema to validate req.params against. */
    params?: z.ZodType<unknown>;
    /**
     * Strip unknown keys from the validated object.
     * Defaults to `true` for body (prevents prototype-pollution via extra keys),
     * `false` for query/params (Express merges these).
     */
    stripUnknown?: boolean;
}

/**
 * Express middleware factory that validates request body / query / params
 * against the provided Zod schemas.
 *
 * On validation failure it returns a standardised 400 JSON response:
 *   { error: string, details: ZodIssue[], requestId?: string }
 *
 * On success it replaces the raw values with the parsed (and optionally
 * stripped) data so downstream handlers receive fully-typed, safe objects.
 *
 * @example
 * ```ts
 * router.post(
 *   "/reports",
 *   validateRequest({
 *     body: createReportSchema,
 *     query: paginationSchema,
 *   }),
 *   handler,
 * );
 * ```
 */
export function validateRequest(options: ValidateRequestOptions) {
    const { body, query, params } = options;

    // At least one schema must be provided
    if (!body && !query && !params) {
        throw new Error("validateRequest: at least one of body, query, or params schema must be provided");
    }

    // Resolve stripUnknown defaults once: body defaults to true, query/params to false
    const shouldStripBody = options.stripUnknown !== undefined ? options.stripUnknown : true;
    const shouldStripOther = options.stripUnknown !== undefined ? options.stripUnknown : false;

    return (req: Request, res: Response, next: NextFunction): void => {
        const errors: z.ZodIssue[] = [];
        const requestId = getRequestId();

        // Validate body
        if (body) {
            const result = body.safeParse(req.body, { stripUnknown: shouldStripBody });
            if (!result.success) {
                errors.push(...result.error.issues);
            } else {
                // Replace with parsed & stripped data
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (req as any).body = result.data;
            }
        }

        // Validate query
        if (query) {
            const result = query.safeParse(req.query, { stripUnknown: shouldStripOther });
            if (!result.success) {
                errors.push(...result.error.issues);
            } else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (req as any).query = result.data;
            }
        }

        // Validate params
        if (params) {
            const result = params.safeParse(req.params, { stripUnknown: shouldStripOther });
            if (!result.success) {
                errors.push(...result.error.issues);
            } else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (req as any).params = result.data;
            }
        }

        if (errors.length > 0) {
            const response: ValidationErrorResponse = {
                error: "Validation failed",
                details: errors,
            };
            if (requestId) {
                response.requestId = requestId;
            }
            res.status(400).json(response);
            return;
        }

        next();
    };
}
