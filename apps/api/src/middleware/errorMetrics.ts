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

