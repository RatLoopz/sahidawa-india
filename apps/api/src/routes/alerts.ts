import { Router, Request, Response } from "express";
import { supabase } from "../db/client";
import { z } from "zod";
import { triggerRecallAlert } from "../services/notifications";
import { validateMedicineStatus, getValidStatusList } from "../validators/medicine.validator";
import { escapeIlike } from "../utils/db";
import { requireApiKey, ApiKeyRequest } from "../middleware/apiKeyAuth";
import logger from "../utils/logger";
import { redisClient } from "../utils/redis";
import { KEY_PREFIXES } from "../services/cache.service";
import { limiter, alertsReadLimiter } from "../middleware/rateLimit";
import { requireAuth, requireRole } from "../middleware/auth";
import { uuidSchema } from "../utils/validation";

const AlertSchema = z
    .object({
        reported_brand_name: z.string().optional(),
        batch_number: z.string().optional(),
        manufacturer: z.string().optional(),
        alert_type: z.string().optional(),
        state: z.string().optional(),
        district: z.string().optional(),
        reported_at: z.string().optional(),
        proof_image_url: z.string().optional().nullable(),
    })
    .passthrough();

const AlertsArraySchema = z.array(AlertSchema);

const alertsRouter = Router();

/**
 * GET /api/v1/alerts
 * Paginated alerts endpoint.
 *
 * Query params:
 *   page  — 1-based page index (default: 1)
 *   limit — items per page (default: 10, max: 100)
 *
 * Response schema:
 *   {
 *     data:                      Alert[],
 *     pageIndex:                 number,   // current page (1-based)
 *     pageSize:                  number,   // items returned on this page
 *     totalCount:                number,   // total rows matching the filters
 *     totalPageCount:            number,   // ceil(totalCount / limit)
 *     totalCriticalCount:        number,   // system-wide count of banned/counterfeit alerts (not just this page)
 *     totalImpactedRegionsCount: number,   // system-wide count of distinct impacted states (not just this page)
 *   }
 */
alertsRouter.get("/", alertsReadLimiter, async (req: Request, res: Response) => {
    const rawPage = parseInt(req.query.page as string, 10);
    const rawLimit = parseInt(req.query.limit as string, 10);
    const brand = req.query.brand as string;
    const region = req.query.region as string;
    const batchNumber = req.query.batch_number as string;

    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 10 : Math.min(rawLimit, 100);

    const offset = (page - 1) * limit;

    let query = supabase
        .from("drug_alerts")
        .select("*", { count: "exact" })
        .or(`snoozed_until.is.null,snoozed_until.lte.${new Date().toISOString()}`);

    if (brand) {
        query = query.ilike("reported_brand_name", `%${escapeIlike(brand)}%`);
    }
    if (region) {
        query = query.ilike("state", `%${escapeIlike(region)}%`);
    }
    if (batchNumber) {
        query = query.eq("batch_number", batchNumber);
    }

    try {
        // Helper to handle the Cache-Aside pattern for aggregate stats
        const getCachedStats = async () => {
            const cacheKey = `alerts:stats:brand=${brand || "all"}:region=${region || "all"}:batch=${batchNumber || "all"}`;
            const TTL_SECONDS = 900; // 15 minutes

            // 1. Try to fetch from Redis first
            if (redisClient.isOpen) {
                try {
                    const cachedData = await redisClient.get(cacheKey);
                    if (cachedData) {
                        return { data: JSON.parse(cachedData), error: null };
                    }
                } catch (cacheError) {
                    logger.warn(`[Redis Read Failed] Key: ${cacheKey}`, { error: cacheError });
                }
            }

            // 2. Cache Miss or Redis down: Execute the heavy DB RPC
            const result = await supabase.rpc("get_alerts_aggregate_stats", {
                p_brand: brand || null,
                p_region: region || null,
                p_batch_number: batchNumber || null,
            });

            // 3. Save to Redis (Fire and Forget)
            if (!result.error && result.data && redisClient.isOpen) {
                try {
                    await redisClient.set(cacheKey, JSON.stringify(result.data), {
                        EX: TTL_SECONDS,
                    });
                } catch (cacheWriteError) {
                    logger.warn(`[Redis Write Failed] Key: ${cacheKey}`, {
                        error: cacheWriteError,
                    });
                }
            }

            return result;
        };

        // Run the paginated page fetch and the system-wide stats aggregation concurrently
        const [pageResult, statsResult] = await Promise.all([
            query.order("created_at", { ascending: false }).range(offset, offset + limit - 1),
            getCachedStats(),
        ]);

        const { data, error, count } = pageResult;

        if (error) {
            res.status(500).json({ error: "Failed to fetch alerts" });
            return;
        }

        if (statsResult.error) {
            // Don't fail the whole request over the stats panel — log and degrade
            // gracefully so the alert list itself still loads.
            logger.error("Failed to fetch alert aggregate stats", { error: statsResult.error });
        }

        const stats = (statsResult.data ?? {}) as {
            totalCriticalCount?: number;
            totalImpactedRegionsCount?: number;
        };

        const totalCount = count ?? 0;
        const totalPageCount = Math.ceil(totalCount / limit);

        res.json({
            data: data ?? [],
            pageIndex: page,
            pageSize: (data ?? []).length,
            totalCount,
            totalPageCount,
            totalCriticalCount: stats.totalCriticalCount ?? 0,
            totalImpactedRegionsCount: stats.totalImpactedRegionsCount ?? 0,
        });
    } catch (err) {
        logger.error("Unexpected error in GET /api/alerts", { error: err });
        res.status(500).json({ error: "An unexpected error occurred" });
    }
});

/**
 * POST /api/v1/alerts/ingest
 * Protected endpoint to ingest parsed CDSCO alerts from the ML agent.
 */
alertsRouter.post("/ingest", requireApiKey, limiter, async (req: ApiKeyRequest, res: Response) => {
    const ingestSchema = z
        .object({
            alerts: AlertsArraySchema,
        })
        .strict();

    const parseResult = ingestSchema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({
            error: "Invalid payload schema or unknown fields",
            details: parseResult.error,
        });
        return;
    }

    const validatedAlerts = parseResult.data.alerts;

    try {
        // 2. Upsert alerts — ON CONFLICT DO NOTHING prevents duplicate rows
        // when concurrent scraper instances race past the pre-check in deduplicate_alerts().
        const { data: insertedAlerts, error: insertError } = await supabase
            .from("drug_alerts")
            .upsert(validatedAlerts, {
                onConflict: "batch_number,manufacturer,reported_brand_name",
                ignoreDuplicates: true,
            })
            .select();

        if (insertError) {
            logger.error("Error inserting alerts", { error: insertError });
            res.status(500).json({ error: "Database error inserting alerts" });
            return;
        }

        // 3. Update medicines table based on matched batches
        const medicineStatus = "recalled";
        if (!validateMedicineStatus(medicineStatus)) {
            res.status(400).json({
                error: `Invalid medicine status. Valid values are: ${getValidStatusList()}`,
            });
            return;
        }

        // Batch the medicine status updates to avoid O(N) individual UPDATE queries.
        // Alerts are grouped into two buckets by their secondary discriminator:
        //   - byManufacturer: alerts that have a manufacturer field
        //   - byBrandName:    alerts that have only a brand name (no manufacturer)
        // Each bucket is resolved in a single UPDATE ... WHERE batch_number IN (...)
        // query, capping the total number of DB round-trips at 2 regardless of N.
        const byManufacturer = new Map<string, string[]>(); // manufacturer -> batch_numbers[]
        const byBrandName = new Map<string, string[]>(); // brand_name -> batch_numbers[]
        const noBatchAlerts: typeof validatedAlerts = [];

        for (const alert of validatedAlerts) {
            if (!alert.batch_number) {
                noBatchAlerts.push(alert);
                continue;
            }
            if (alert.manufacturer) {
                if (!byManufacturer.has(alert.manufacturer)) {
                    byManufacturer.set(alert.manufacturer, []);
                }
                byManufacturer.get(alert.manufacturer)!.push(alert.batch_number);
            } else if (alert.reported_brand_name) {
                if (!byBrandName.has(alert.reported_brand_name)) {
                    byBrandName.set(alert.reported_brand_name, []);
                }
                byBrandName.get(alert.reported_brand_name)!.push(alert.batch_number);
            }
        }

        const batchUpdatePromises: Promise<unknown>[] = [];

        for (const [manufacturer, batchNumbers] of byManufacturer) {
            batchUpdatePromises.push(
                Promise.resolve(
                    supabase
                        .from("medicines")
                        .update({ status: medicineStatus, is_counterfeit_alert: true })
                        .in("batch_number", batchNumbers)
                        .eq("manufacturer", manufacturer)
                )
            );
        }

        for (const [brandName, batchNumbers] of byBrandName) {
            batchUpdatePromises.push(
                Promise.resolve(
                    supabase
                        .from("medicines")
                        .update({ status: medicineStatus, is_counterfeit_alert: true })
                        .in("batch_number", batchNumbers)
                        .eq("brand_name", brandName)
                )
            );
        }

        await Promise.all(batchUpdatePromises);

        // 3.5 Invalidate the cache for the updated batch numbers
        const batchNumbersToInvalidate = validatedAlerts
            .map((alert) => alert.batch_number)
            .filter(Boolean) as string[];

        if (batchNumbersToInvalidate.length > 0 && redisClient.isOpen) {
            try {
                const keys = batchNumbersToInvalidate.map(
                    (batch) => `${KEY_PREFIXES.DRUG_CACHE}${batch}`
                );
                await redisClient.del(keys);
            } catch (err) {
                logger.error({
                    message: "Failed to invalidate cache for alert batches",
                    error: err,
                });
            }
        }

        // 4. Dispatch Web Push Notifications using shared service
        if (insertedAlerts && insertedAlerts.length > 0) {
            const pushPromises = insertedAlerts.map((alert) => {
                return triggerRecallAlert({
                    id: alert.id ? String(alert.id) : "unknown",
                    medicineName: alert.reported_brand_name || "Unknown Medicine",
                    batchNumber: alert.batch_number,
                    manufacturer: alert.manufacturer,
                    reason: `Alert of type ${alert.alert_type || "NSQ"} in ${alert.state || "Unknown region"}`,
                    severity: "high",
                    source: "CDSCO Live Feed",
                    recalledAt: alert.reported_at || new Date().toISOString(),
                });
            });
            await Promise.all(pushPromises);
        }

        logger.info("Alerts ingested successfully", {
            caller: req.apiKey?.userId,
            count: insertedAlerts?.length,
        });

        res.status(200).json({
            success: true,
            message: "Alerts ingested and notifications dispatched",
            inserted: insertedAlerts?.length,
        });
    } catch (error) {
        logger.error("Unexpected error in /ingest", { error, caller: req.apiKey?.userId });
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * PATCH /api/v1/alerts/:id/snooze
 * Snoozes a drug alert for a given number of days.
 */
alertsRouter.patch(
    "/:id/snooze",
    limiter,
    requireAuth,
    requireRole("admin", "moderator"),
    async (req, res: Response) => {
        const parsedId = uuidSchema.safeParse(req.params.id);
        if (!parsedId.success) {
            res.status(400).json({ error: "Invalid UUID format" });
            return;
        }

        const snoozeSchema = z.object({
            days: z.number().min(1).max(365).default(7),
        });

        const parsedBody = snoozeSchema.safeParse(req.body);
        if (!parsedBody.success) {
            res.status(400).json({ error: "Invalid snooze payload", details: parsedBody.error });
            return;
        }

        const snoozedUntil = new Date();
        snoozedUntil.setDate(snoozedUntil.getDate() + parsedBody.data.days);

        const { error } = await supabase
            .from("drug_alerts")
            .update({ snoozed_until: snoozedUntil.toISOString() })
            .eq("id", req.params.id);

        if (error) {
            logger.error("Failed to snooze alert", { error, id: req.params.id });
            res.status(500).json({ error: "Failed to snooze alert" });
            return;
        }

        res.json({ success: true, snoozed_until: snoozedUntil.toISOString() });
    }
);

export default alertsRouter;
