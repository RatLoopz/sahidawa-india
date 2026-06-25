import { Request, Response, NextFunction } from "express";
import { redisClient } from "../utils/redis";
import logger from "../utils/logger";

/**
 * Function used to generate a unique cache key for a request.
 */
type CacheKeyGenerator = (req: Request) => string;

/**
 * Reusable Redis cache middleware.
 *
 * - Checks Redis before route execution.
 * - Returns cached response on cache hit.
 * - Transparently caches successful responses.
 * - Falls back gracefully if Redis is unavailable.
 *
 * @param ttl Cache expiration time in seconds
 * @param keyGenerator Function that generates a cache key from the request
 */
export const redisCache =
    (ttl: number, keyGenerator: CacheKeyGenerator) =>
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const cacheKey = keyGenerator(req);

        // Skip caching entirely when Redis is unavailable.
        if (!redisClient.isOpen) {
            next();
            return;
        }

        try {
            // Check Redis before executing route logic.
            const cached = await redisClient.get(cacheKey);

            if (cached) {
                res.json(JSON.parse(cached));
                return;
            }
        } catch (error) {
            logger.warn("Redis cache read failed", { error });
            next();
            return;
        }

        // Preserve original response methods.
        const originalJson = res.json.bind(res);
        const originalSend = res.send.bind(res);

        /**
         * Cache JSON responses before sending them to the client.
         */
        res.json = function (body: unknown): Response {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                redisClient.set(cacheKey, JSON.stringify(body), { EX: ttl }).catch((error) => {
                    logger.warn("Redis cache write failed", { error });
                });
            }

            return originalJson(body);
        };

        /**
         * Cache non-JSON responses before sending them to the client.
         */
        res.send = function (body: unknown): Response {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                redisClient.set(cacheKey, JSON.stringify(body), { EX: ttl }).catch((error) => {
                    logger.warn("Redis cache write failed", { error });
                });
            }

            return originalSend(body);
        };

        next();
    };
