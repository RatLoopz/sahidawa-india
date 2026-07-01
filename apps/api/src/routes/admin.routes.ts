import { Router, Request, Response } from "express";
import { z } from "zod";

import { requireAuth, requireRole } from "../middleware/auth";
import { supabase } from "../db/client";
import {
    getPendingReports,
    updateReportStatus,
    getAllMedicines,
    createMedicine,
    getAuditLogs,
    getPendingPharmacies,
    updatePharmacyStatus,
    getAllPharmacies,
    deletePharmacy,
    restorePharmacy,
} from "../controllers/admin.controller";
import { invalidateDrugCache, KEY_PREFIXES } from "../services/cache.service";
import { redisClient } from "../utils/redis";
import { getPushNotificationAnalytics } from "./analytics";
import { limiter } from "../middleware/rateLimit";
import { logAdminAction } from "../services/audit.service";
import { AuthenticatedRequest } from "../middleware/auth";

const router = Router();

router.use(limiter);

router.get("/reports", requireAuth, requireRole("admin", "moderator"), getPendingReports);
const CACHE_INVALIDATION_CHUNK_SIZE = 100;
router.get("/medicines", requireAuth, requireRole("admin", "moderator"), getAllMedicines);
router.get(
    "/pharmacies/pending",
    requireAuth,
    requireRole("admin", "moderator"),
    getPendingPharmacies
);
router.get("/logs", requireAuth, requireRole("admin", "moderator"), getAuditLogs);
router.get(
    "/push-notifications/analytics",
    requireAuth,
    requireRole("admin", "moderator"),
    getPushNotificationAnalytics
);
router.patch("/reports/:id/status", requireAuth, requireRole("admin"), updateReportStatus);
router.post("/medicines", requireAuth, requireRole("admin"), createMedicine);
router.patch("/pharmacies/:id/status", requireAuth, requireRole("admin"), updatePharmacyStatus);
router.get("/pharmacies", requireAuth, requireRole("admin", "moderator"), getAllPharmacies);
router.delete("/pharmacies/:id", limiter, requireAuth, requireRole("admin"), deletePharmacy);
router.post(
    "/pharmacies/:id/deactivate",
    limiter,
    requireAuth,
    requireRole("admin"),
    deletePharmacy
);
router.post("/pharmacies/:id/restore", limiter, requireAuth, requireRole("admin"), restorePharmacy);

const InvalidateCacheSchema = z.object({
    drugIds: z
        .array(z.string().uuid({ message: "Each drugId must be a valid UUID" }))
        .max(100, "Maximum 100 drug IDs per request")
        .optional()
        .default([]),
    batchNumbers: z
        .array(
            z
                .string()
                .max(100, "Batch number too long")
                .regex(/^[A-Za-z0-9\-\/]+$/, "Invalid batch number format")
        )
        .max(500, "Maximum 500 batch numbers per request")
        .optional()
        .default([]),
});

router.post(
    "/cache/invalidate",
    requireAuth,
    requireRole("admin", "moderator"),
    limiter,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const parsed = InvalidateCacheSchema.safeParse(req.body);

            if (!parsed.success) {
                res.status(400).json({
                    success: false,
                    error: "Invalid payload format",
                    details: parsed.error.issues,
                });
                return;
            }

            const { drugIds, batchNumbers } = parsed.data;

            if (drugIds.length === 0 && batchNumbers.length === 0) {
                res.status(400).json({
                    success: false,
                    error: "Provide at least one drugId or batchNumber",
                });
                return;
            }

            let totalKeysInvalidated = 0;

            // --- drugIds path ---
            if (drugIds.length > 0) {
                const deletedKeys = await invalidateDrugCache(drugIds);
                totalKeysInvalidated += deletedKeys.length;
            }

            // --- batchNumbers path ---
            if (batchNumbers.length > 0 && redisClient.isOpen) {
                const keys = batchNumbers.map((batch) => `${KEY_PREFIXES.DRUG_CACHE}${batch}`);

                // Chunked DEL — never fire one command with 500 keys
                for (let i = 0; i < keys.length; i += CACHE_INVALIDATION_CHUNK_SIZE) {
                    const chunk = keys.slice(i, i + CACHE_INVALIDATION_CHUNK_SIZE);
                    await redisClient.del(chunk);
                }

                totalKeysInvalidated += keys.length;
            }

            // --- Audit log ---
            await logAdminAction(req.user!.id, "CACHE_INVALIDATE", "MEDICINE", "cache", {
                drugIds_count: drugIds.length,
                batchNumbers_count: batchNumbers.length,
                total_keys_invalidated: totalKeysInvalidated,
                timestamp: new Date().toISOString(),
            });

            res.status(200).json({
                success: true,
                message: "Cache invalidated successfully",
                invalidated: totalKeysInvalidated,
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                error: (err as Error).message,
            });
        }
    }
);

router.post(
    "/cache/invalidate-synonyms",
    requireAuth,
    requireRole("admin", "moderator"),
    async (req: Request, res: Response) => {
        try {
            const { medicineNameNormalizer } = await import("../utils/medicineNameNormalizer.js");

            // Delete cache from Redis
            if (redisClient.isOpen) {
                await redisClient.del("ocr_synonyms:data");
            }

            // Reload into memory
            await medicineNameNormalizer.loadFromDatabase();

            res.status(200).json({
                success: true,
                message: "OCR Synonyms cache invalidated and reloaded successfully",
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                error: (err as Error).message,
            });
        }
    }
);

const BulkSynonymsSchema = z
    .array(
        z.object({
            original_term: z.string().min(1),
            normalized_term: z.string().min(1),
            type: z.enum(["synonym", "misread"]),
        })
    )
    .max(1000, "Maximum 1000 rules per request");

router.post(
    "/synonyms/bulk",
    requireAuth,
    requireRole("admin", "moderator"),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const parsed = BulkSynonymsSchema.safeParse(req.body);

            if (!parsed.success) {
                res.status(400).json({
                    success: false,
                    error: "Invalid payload format",
                    details: parsed.error.issues,
                });
                return;
            }

            const rows = parsed.data;

            if (rows.length === 0) {
                res.status(400).json({ success: false, error: "Empty payload" });
                return;
            }

            const { error } = await supabase.from("ocr_synonyms").insert(rows);

            if (error) {
                res.status(500).json({ success: false, error: error.message });
                return;
            }

            // Invalidate cache
            if (redisClient.isOpen) {
                await redisClient.del("ocr_synonyms:data");
            }
            const { medicineNameNormalizer } = await import("../utils/medicineNameNormalizer.js");
            await medicineNameNormalizer.loadFromDatabase();

            await logAdminAction(req.user!.id, "BULK_INSERT_SYNONYMS", "MEDICINE", "bulk", {
                count: rows.length,
            });

            res.status(200).json({
                success: true,
                message: "Synonyms added successfully",
                inserted: rows.length,
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                error: (err as Error).message,
            });
        }
    }
);

export default router;
