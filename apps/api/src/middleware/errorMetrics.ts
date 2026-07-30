import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../utils/redis';
import logger from '../utils/logger';

const METRICS_PREFIX = 'metrics:errors:';
const METRICS_WINDOW_SECONDS = 3600; // 1 hour window

/**
 * Middleware to track error rates by route and status code.
 * Stores metrics in Redis with automatic expiration.
 */
export function errorMetricsMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Track response completion
    res.on('finish', async () => {
        const statusCode = res.statusCode;
        
        // Only track errors (4xx and 5xx)
        if (statusCode < 400) return;
        
        // Normalize route pattern (remove query params and IDs)
        const route = normalizeRoute(req.route?.path || req.path);
        const method = req.method;
        const metricKey = `${METRICS_PREFIX}${method}:${route}:${statusCode}`;
        const globalKey = `${METRICS_PREFIX}global:${statusCode}`;
        
        try {
            if (redisClient.isOpen) {
                // Increment route-specific counter
                await redisClient.incr(metricKey);
                await redisClient.expire(metricKey, METRICS_WINDOW_SECONDS);
                
                // Increment global status code counter
                await redisClient.incr(globalKey);
                await redisClient.expire(globalKey, METRICS_WINDOW_SECONDS);
                
                // Store in hourly set for time-series analysis
                const hourBucket = Math.floor(Date.now() / (60 * 60 * 1000));
                await redisClient.zAdd(`${METRICS_PREFIX}timeline`, {
                    score: hourBucket,
                    value: `${method}:${route}:${statusCode}:${Date.now()}`,
                });
            }
        } catch (err) {
            // Don't let metrics failures affect request handling
            logger.warn('Failed to record error metrics', {
                error: String(err),
                route,
                statusCode,
            });
        }
    });
    
    next();
}

/**
 * Normalize route patterns to group similar endpoints.
 * Converts /api/v1/medicines/abc-123 to /api/v1/medicines/:id
 */
function normalizeRoute(path: string): string {
    return path
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
        .replace(/\/\d+/g, '/:id')
        .replace(/\/[A-Za-z0-9_-]{20,}/g, '/:id');
}

/**
 * Get error metrics summary for a given time window.
 */
export async function getErrorMetrics(): Promise<{
    total: number;
    byStatusCode: Record<string, number>;
    byRoute: Record<string, number>;
}> {
    const result = {
        total: 0,
        byStatusCode: {} as Record<string, number>,
        byRoute: {} as Record<string, number>,
    };
    
    try {
        if (!redisClient.isOpen) return result;
        
        // Get all error metric keys
        const keys: string[] = [];
        let cursor = 0;
        
        do {
            const [newCursor, foundKeys] = await redisClient.scan(cursor, {
                MATCH: `${METRICS_PREFIX}*`,
                COUNT: 100,
            });
            cursor = newCursor;
            keys.push(...foundKeys);
        } while (cursor !== 0);
        
        // Aggregate metrics
        for (const key of keys) {
            const value = await redisClient.get(key);
            if (!value) continue;
            
            const count = parseInt(value, 10);
            if (isNaN(count)) continue;
            
            result.total += count;
            
            // Parse key to extract route and status code
            const parts = key.replace(METRICS_PREFIX, '').split(':');
            if (parts.length >= 3) {
                const [method, ...rest] = parts;
                const statusCode = rest.pop() || 'unknown';
                const route = rest.join(':');
                
                result.byStatusCode[statusCode] = (result.byStatusCode[statusCode] || 0) + count;
                result.byRoute[`${method}:${route}`] = (result.byRoute[`${method}:${route}`] || 0) + count;
            }
        }
    } catch (err) {
        logger.warn('Failed to fetch error metrics', { error: String(err) });
    }
    
    return result;
}
