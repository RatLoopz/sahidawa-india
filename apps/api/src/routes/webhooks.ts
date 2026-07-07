import { Router, Request, Response } from "express";
import { safeCompare } from "../utils/cryptoUtils";
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
        // Verify secret token using a timing-safe comparison
        const secret = process.env.SUPABASE_WEBHOOK_SECRET;
        const authHeader = req.headers["authorization"];

        const isValid =
            typeof secret === "string" &&
            typeof authHeader === "string" &&
            safeCompare(authHeader, `Bearer ${secret}`);

        if (!isValid) {
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

/**
 * POST /api/webhooks/supabase/medicines
 *
 * Supabase Database Webhook endpoint — triggered on INSERT, UPDATE, or DELETE
 * on the medicines table. Invalidates all matching Redis cache keys.
 *
 * Secured via SUPABASE_WEBHOOK_SECRET environment variable.
 */
router.post(
    "/supabase/medicines",
    webhookLimiter,
    async (req: Request, res: Response): Promise<void> => {
        // Verify secret token using a timing-safe comparison
        const secret = process.env.SUPABASE_WEBHOOK_SECRET;
        const authHeader = req.headers["authorization"];

        const isValid =
            typeof secret === "string" &&
            typeof authHeader === "string" &&
            safeCompare(authHeader, `Bearer ${secret}`);

        if (!isValid) {
            logger.warn("Unauthorized webhook attempt on /api/webhooks/supabase/medicines", {
                ip: req.ip,
                headers: req.headers,
            });
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        try {
            if (!redisClient.isOpen) {
                logger.warn("Redis not connected — skipping cache invalidation");
                res.status(200).json({ invalidated: 0, message: "Redis unavailable" });
                return;
            }

            const payload = req.body;
            const record = payload.record || payload.old_record || {};
            const batchNumber = record.batch_number;
            const brandName = record.brand_name;
            const genericName = record.generic_name;

            const keysToDelete: string[] = [];

            // 1. Invalidate drug lookup cache by scanning for keys starting with the batch number
            if (batchNumber) {
                let cursor: any = 0;
                do {
                    const result = await redisClient.scan(cursor, {
                        MATCH: `drug:batch:${batchNumber}*`,
                        COUNT: 100,
                    });
                    cursor = result.cursor;
                    keysToDelete.push(...result.keys);
                } while (cursor !== 0);
            }

            // 2. Invalidate voice search cache for matching brand and generic names
            if (brandName) {
                const normalizedBrand = brandName.toLowerCase().replace(/\s+/g, "_");
                keysToDelete.push(`medicine:voice:${normalizedBrand}`);
            }
            if (genericName) {
                const normalizedGeneric = genericName.toLowerCase().replace(/\s+/g, "_");
                keysToDelete.push(`medicine:voice:${normalizedGeneric}`);
            }

            // 3. Perform deletion if keys exist
            const uniqueKeys = Array.from(new Set(keysToDelete));
            if (uniqueKeys.length > 0) {
                await redisClient.del(uniqueKeys);
                logger.info(`Medicine cache invalidated — deleted ${uniqueKeys.length} key(s)`, {
                    keys: uniqueKeys,
                });
            } else {
                logger.info("Medicine webhook fired — no cache keys found to invalidate");
            }

            res.status(200).json({
                invalidated: uniqueKeys.length,
                keys: uniqueKeys,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error("Failed to invalidate medicine cache via webhook", { error: message });
            res.status(500).json({ error: "Cache invalidation failed" });
        }
    }
);

/**
 * Helper to execute cache invalidation out-of-band/non-blocking
 */
function handleAsyncInvalidation(table: string, pattern: string, res: Response) {
    // Non-blocking asynchronous execution context
    (async () => {
        try {
            if (!redisClient.isOpen) {
                logger.warn(`Redis not connected — skipping ${table} cache invalidation`);
                return;
            }

            let cursor: any = 0;
            const keysToDelete: string[] = [];

            do {
                const result = await redisClient.scan(cursor, {
                    MATCH: pattern,
                    COUNT: 100,
                });
                cursor = result.cursor;
                keysToDelete.push(...result.keys);
            } while (cursor !== 0);

            if (keysToDelete.length > 0) {
                await redisClient.del(keysToDelete);
                logger.info(
                    `Cache invalidated for ${table} — deleted ${keysToDelete.length} key(s)`,
                    { keys: keysToDelete }
                );
            } else {
                logger.info(`${table} webhook fired — no cache keys found to invalidate`);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error(`Failed to execute async cache invalidation for ${table}`, {
                error: message,
            });
        }
    })();

    // Immediate acknowledgement response without blocking primary context
    res.status(200).json({ success: true, message: `Invalidation event dispatched for ${table}` });
}

/**
 * POST /api/webhooks/supabase/pharmacies
 */
router.post(
    "/supabase/pharmacies",
    webhookLimiter,
    async (req: Request, res: Response): Promise<void> => {
        const secret = process.env.SUPABASE_WEBHOOK_SECRET;
        const authHeader = req.headers["authorization"];
        const isValid =
            typeof secret === "string" &&
            typeof authHeader === "string" &&
            safeCompare(authHeader, `Bearer ${secret}`);

        if (!isValid) {
            logger.warn("Unauthorized webhook attempt on /api/webhooks/supabase/pharmacies", {
                ip: req.ip,
            });
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const payload = req.body;
        const record = payload.record || payload.old_record || {};
        const id = record.id;

        // Single entity or collection clear pattern mapping
        const pattern = id ? `pharmacy:${id}*` : "pharmacy:*";
        handleAsyncInvalidation("pharmacies", pattern, res);
    }
);

/**
 * POST /api/webhooks/supabase/reports
 */
router.post(
    "/supabase/reports",
    webhookLimiter,
    async (req: Request, res: Response): Promise<void> => {
        const secret = process.env.SUPABASE_WEBHOOK_SECRET;
        const authHeader = req.headers["authorization"];
        const isValid =
            typeof secret === "string" &&
            typeof authHeader === "string" &&
            safeCompare(authHeader, `Bearer ${secret}`);

        if (!isValid) {
            logger.warn("Unauthorized webhook attempt on /api/webhooks/supabase/reports", {
                ip: req.ip,
            });
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const payload = req.body;
        const record = payload.record || payload.old_record || {};
        const id = record.id;

        const pattern = id ? `report:${id}*` : "report:*";
        handleAsyncInvalidation("reports", pattern, res);
    }
);

/**
 * POST /api/webhooks/supabase/users
 */
router.post(
    "/supabase/users",
    webhookLimiter,
    async (req: Request, res: Response): Promise<void> => {
        const secret = process.env.SUPABASE_WEBHOOK_SECRET;
        const authHeader = req.headers["authorization"];
        const isValid =
            typeof secret === "string" &&
            typeof authHeader === "string" &&
            safeCompare(authHeader, `Bearer ${secret}`);

        if (!isValid) {
            logger.warn("Unauthorized webhook attempt on /api/webhooks/supabase/users", {
                ip: req.ip,
            });
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const payload = req.body;
        const record = payload.record || payload.old_record || {};
        const id = record.id;

        const pattern = id ? `user:${id}*` : "user:*";
        handleAsyncInvalidation("users", pattern, res);
    }
);

export default router;
