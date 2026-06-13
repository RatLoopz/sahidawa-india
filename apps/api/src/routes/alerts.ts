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

const AlertSchema = z
    .object({
        reported_brand_name: z.string().optional(),
        batch_number: z.string().optional(),
        manufacturer: z.string().optional(),
        alert_type: z.string().optional(),
        state: z.string().optional(),
        district: z.string().optional(),
        reported_at: z.string().optional(),
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
 *     data:           Alert[],
 *     pageIndex:      number,   // current page (1-based)
 *     pageSize:       number,   // items returned on this page
 *     totalCount:     number,   // total rows in the table
 *     totalPageCount: number,   // ceil(totalCount / limit)
 *   }
 */
alertsRouter.get("/", async (req: Request, res: Response) => {
    const rawPage = parseInt(req.query.page as string, 10);
    const rawLimit = parseInt(req.query.limit as string, 10);
    const brand = req.query.brand as string;
    const region = req.query.region as string;
    const batchNumber = req.query.batch_number as string;

    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 10 : Math.min(rawLimit, 100);

    const offset = (page - 1) * limit;

    let query = supabase.from("drug_alerts").select("*", { count: "exact" });

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
        const { data, error, count } = await query
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            res.status(500).json({ error: "Failed to fetch alerts" });
            return;
        }

        const totalCount = count ?? 0;
        const totalPageCount = Math.ceil(totalCount / limit);

        res.json({
            data: data ?? [],
            pageIndex: page,
            pageSize: (data ?? []).length,
            totalCount,
            totalPageCount,
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
alertsRouter.post("/ingest", requireApiKey, async (req: ApiKeyRequest, res: Response) => {
    const { alerts } = req.body;
    const parseResult = AlertsArraySchema.safeParse(alerts);
    if (!parseResult.success) {
        res.status(400).json({ error: "Invalid payload schema", details: parseResult.error });
        return;
    }

    const validatedAlerts = parseResult.data;

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

        const updatePromises = validatedAlerts.map((alert) => {
            if (alert.batch_number) {
                let q = supabase
                    .from("medicines")
                    .update({ status: medicineStatus, is_counterfeit_alert: true })
                    .eq("batch_number", alert.batch_number);

                if (alert.manufacturer) {
                    q = q.eq("manufacturer", alert.manufacturer);
                } else if (alert.reported_brand_name) {
                    q = q.eq("brand_name", alert.reported_brand_name);
                }
                return q;
            }
            return Promise.resolve();
        });

        await Promise.all(updatePromises);

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
                console.error("Failed to invalidate cache for alert batches:", err);
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
            caller: req.apiKey?.callerName,
            count: insertedAlerts?.length,
        });

        res.status(200).json({
            success: true,
            message: "Alerts ingested and notifications dispatched",
            inserted: insertedAlerts?.length,
        });
    } catch (error) {
        logger.error("Unexpected error in /ingest", { error, caller: req.apiKey?.callerName });
        res.status(500).json({ error: "Internal server error" });
    }
});

export default alertsRouter;
