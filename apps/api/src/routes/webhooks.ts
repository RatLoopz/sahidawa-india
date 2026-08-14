import { Router, Request, Response } from "express";
import { safeCompare } from "../utils/cryptoUtils";
import { redisClient } from "../utils/redis";
import logger from "../utils/logger";
import { webhookLimiter } from "../middleware/rateLimit";
import { invalidateCacheByPattern } from "../services/cache.service";

const router = Router();

/** Log IP + header names only — never Authorization values or raw header maps. */
function unauthorizedWebhookMeta(req: Request) {
    return {
        ip: req.ip,
        headerNames: Object.keys(req.headers).map((name) => name.toLowerCase()),
    };
}

/** Shared Bearer secret check for all webhook routes. Returns false after sending 401. */
function assertWebhookAuth(req: Request, res: Response, routePath: string): boolean {
    const secret = process.env.SUPABASE_WEBHOOK_SECRET;
    const authHeader = req.headers["authorization"];
    const isValid =
        typeof secret === "string" &&
        typeof authHeader === "string" &&
        safeCompare(authHeader, `Bearer ${secret}`);

    if (isValid) {
        return true;
    }

    logger.warn(`Unauthorized webhook attempt on ${routePath}`, unauthorizedWebhookMeta(req));
    res.status(401).json({ error: "Unauthorized" });
    return false;
}

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
        if (!assertWebhookAuth(req, res, "/api/webhooks/supabase/health-schemes")) {
            return;
        }

        // Invalidate all schemes:state:* cache keys using SCAN
        try {
            if (!redisClient.isOpen) {
                logger.warn("Redis not connected — skipping cache invalidation");
                res.status(200).json({ invalidated: 0, message: "Redis unavailable" });
                return;
            }

            const keysToDelete = await invalidateCacheByPattern("schemes:state:*");

            if (keysToDelete.length > 0) {
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
        if (!assertWebhookAuth(req, res, "/api/webhooks/supabase/medicines")) {
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
            const oldRecord = payload.old_record || {};
            const batchNumber = record.batch_number;
            const brandName = record.brand_name;
            const genericName = record.generic_name;
            const oldBrandName = oldRecord.brand_name;
            const oldGenericName = oldRecord.generic_name;

            const keysToDelete: string[] = [];

            // 1. Invalidate drug lookup cache (helper scans and deletes matching keys)
            if (batchNumber) {
                const batchKeys = await invalidateCacheByPattern(`drug:batch:${batchNumber}*`);
                keysToDelete.push(...batchKeys);
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

            // 3. Invalidate verify-brand cache for the old and new brand names and the
            //    old and new generic names (renames leave old-name keys behind).
            for (const name of [brandName, oldBrandName]) {
                if (name) {
                    keysToDelete.push(`brand_cache:${name.trim().toLowerCase()}`);
                }
            }
            for (const name of [genericName, oldGenericName]) {
                if (name) {
                    keysToDelete.push(`brand_cache:${name.trim().toLowerCase()}`);
                }
            }

            // Transitions in either field that feeds the computed `verified` verdict
            // (is_cdsco_verified && !is_counterfeit_alert) can stale verify-brand cache
            // entries keyed by any user-supplied substring (e.g. "dolo"), which exact-name
            // deletion above cannot enumerate — sweep the whole namespace on that rare event.
            if (verificationStatusChanged(oldRecord, record)) {
                const brandCacheKeys = await invalidateCacheByPattern("brand_cache:*");
                keysToDelete.push(...brandCacheKeys);
            }

            // 4. Perform deletion if keys exist
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
 * Whether the computed `verified` verdict could have changed between the old and
 * new medicine records. The verdict derives from both `is_cdsco_verified` and
 * `is_counterfeit_alert`, so a transition in either field can flip it for any
 * user-supplied substring cache key that exact-name deletion cannot enumerate.
 */
function verificationStatusChanged(
    oldRecord: Record<string, unknown>,
    record: Record<string, unknown>
): boolean {
    const flipped = (before: unknown, after: unknown): boolean =>
        before !== undefined && after !== undefined && Boolean(before) !== Boolean(after);
    return (
        flipped(oldRecord.is_counterfeit_alert, record.is_counterfeit_alert) ||
        flipped(oldRecord.is_cdsco_verified, record.is_cdsco_verified)
    );
}

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

            const keysToDelete = await invalidateCacheByPattern(pattern);

            if (keysToDelete.length > 0) {
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
        if (!assertWebhookAuth(req, res, "/api/webhooks/supabase/pharmacies")) {
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
        if (!assertWebhookAuth(req, res, "/api/webhooks/supabase/reports")) {
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
        if (!assertWebhookAuth(req, res, "/api/webhooks/supabase/users")) {
            return;
        }

        const payload = req.body;
        const record = payload.record || payload.old_record || {};
        const id = record.id;

        const pattern = id ? `user:${id}*` : "user:*";
        handleAsyncInvalidation("users", pattern, res);
    }
);

/**
 * POST /api/webhooks/etl/medicines-updated
 *
 * Called by the ETL pipeline after it completes a medicines table upsert.
 * Invalidates ALL drug batch, voice, and interaction cache entries so
 * subsequent API requests pick up fresh data from Supabase.
 *
 * Secured via SUPABASE_WEBHOOK_SECRET environment variable.
 */
router.post(
    "/etl/medicines-updated",
    webhookLimiter,
    async (req: Request, res: Response): Promise<void> => {
        if (!assertWebhookAuth(req, res, "/api/webhooks/etl/medicines-updated")) {
            return;
        }

        try {
            if (!redisClient.isOpen) {
                logger.warn("Redis not connected — skipping ETL cache invalidation");
                res.status(200).json({ invalidated: 0, message: "Redis unavailable" });
                return;
            }

            const patterns = [
                "drug:batch:*",
                "medicine:voice:*",
                "medicine:voice:audio:*",
                "interactions:*",
            ];

            const results: { pattern: string; deleted: number }[] = [];
            for (const pattern of patterns) {
                const keys = await invalidateCacheByPattern(pattern);
                results.push({ pattern, deleted: keys.length });
            }

            const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
            logger.info(
                `ETL cache invalidation complete — deleted ${totalDeleted} key(s) across ${patterns.length} patterns`,
                { results }
            );

            res.status(200).json({ invalidated: totalDeleted, patterns: results });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error("Failed to invalidate cache via ETL webhook", { error: message });
            res.status(500).json({ error: "Cache invalidation failed" });
        }
    }
);

export default router;
