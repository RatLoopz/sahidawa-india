import { Router, Request, Response } from "express";
import { z } from "zod";

import { requireAuth, requireRole } from "../middleware/auth";
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

export default router;
