import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { getRequestId } from './requestId';

const SLOW_QUERY_THRESHOLD_MS = 500;
const CRITICAL_QUERY_THRESHOLD_MS = 2000;

/**
 * Query monitoring middleware.
 * Measures request duration and logs slow queries with structured metadata.
 *
 * - Queries > 500ms are logged at `warn` level
 * - Queries > 2000ms are logged at `error` level
 * - All requests include timing in response headers for debugging
 */
export function queryMetricsMiddleware(req: Request, res: Response, next: NextFunction): void {
    const start = performance.now();
    const requestId = getRequestId();

    res.on('finish', () => {
        const durationMs = Math.round(performance.now() - start);
        const statusCode = res.statusCode;
        const method = req.method;
        const path = req.route?.path || req.path;

        // Always set timing header for debugging
        res.setHeader('X-Response-Time', `${durationMs}ms`);

        // Only log slow or error responses
        if (durationMs > SLOW_QUERY_THRESHOLD_MS || statusCode >= 400) {
            const level = durationMs > CRITICAL_QUERY_THRESHOLD_MS ? 'error' : 'warn';

            logger.log({
                level,
                message: `Slow query detected: ${method} ${path} took ${durationMs}ms`,
                method,
                path,
                statusCode,
                durationMs,
                requestId,
                ...(durationMs > CRITICAL_QUERY_THRESHOLD_MS && {
                    severity: 'critical',
                    message_detail: `Query exceeded ${CRITICAL_QUERY_THRESHOLD_MS}ms threshold`,
                }),
            });
        }
    });

    next();
}

/**
 * Utility to measure async operation duration.
 * Use this to instrument specific database queries or expensive operations.
 *
 * @example
 *   const result = await measureQuery('search_medicines', async () => {
 *     return supabase.rpc('search_medicines_text', { query_text: 'dolo' });
 *   });
 */
export async function measureQuery<T>(
    queryName: string,
    operation: () => Promise<T>
): Promise<T> {
    const start = performance.now();
    const requestId = getRequestId();

    try {
        const result = await operation();
        const durationMs = Math.round(performance.now() - start);

        if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
            const level = durationMs > CRITICAL_QUERY_THRESHOLD_MS ? 'error' : 'warn';
            logger.log({
                level,
                message: `Slow DB operation: ${queryName} took ${durationMs}ms`,
                queryName,
                durationMs,
                requestId,
            });
        }

        return result;
    } catch (err) {
        const durationMs = Math.round(performance.now() - start);
        logger.error(`DB operation failed: ${queryName} after ${durationMs}ms`, {
            queryName,
            durationMs,
            error: err instanceof Error ? err.message : String(err),
            requestId,
        });
        throw err;
    }
}
