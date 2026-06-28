import { Router, Request, Response } from "express";
import { redisClient } from "../utils/redis";
import logger from "../utils/logger";
import { webhookLimiter } from "../middleware/rateLimit";

const router = Router();

/**
 * POST /api/webhooks/supabase/health-schemes
 *
 * Supabase Database Webhook endpoint — triggered on INSERT, UPDATE, or DELETE
 * on the health_schemes table. Invalidates all matching Redis cache keys.
 *
 * Secured via SUPABASE_WEBHOOK_SECRET environment variable.
 */
router.post(
    "/supabase/health-schemes",
    webhookLimiter,
    async (req: Request, res: Response): Promise<void> => {
        // Verify secret token
        const secret = process.env.SUPABASE_WEBHOOK_SECRET;
        const authHeader = req.headers["authorization"];

        if (!secret || authHeader !== `Bearer ${secret}`) {
            logger.warn("Unauthorized webhook attempt on /api/webhooks/supabase/health-schemes", {
                ip: req.ip,
                headers: req.headers,
            });
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        // Invalidate all schemes:state:* cache keys using SCAN
        try {
            if (!redisClient.isOpen) {
                logger.warn("Redis not connected — skipping cache invalidation");
                res.status(200).json({ invalidated: 0, message: "Redis unavailable" });
                return;
            }

            const keysToDelete: string[] = [];
            let cursor: any = 0;

            do {
                const result = await redisClient.scan(cursor, {
                    MATCH: "schemes:state:*",
                    COUNT: 100,
                });
                cursor = result.cursor;
                keysToDelete.push(...result.keys);
            } while (cursor !== 0);

            if (keysToDelete.length > 0) {
                await redisClient.del(keysToDelete);
                logger.info(
                    `Health schemes cache invalidated — deleted ${keysToDelete.length} key(s)`,
                    { keys: keysToDelete }
                );
            } else {
                logger.info("Health schemes webhook fired — no cache keys found to invalidate");
            }

            res.status(200).json({
                invalidated: keysToDelete.length,
                keys: keysToDelete,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error("Failed to invalidate health schemes cache", { error: message });
            res.status(500).json({ error: "Cache invalidation failed" });
        }
    }
);

export default router;
