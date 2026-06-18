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
} from "../controllers/admin.controller";
import { invalidateDrugCache, KEY_PREFIXES } from "../services/cache.service";
import { redisClient } from "../utils/redis";
import { getPushNotificationAnalytics } from "./analytics";
import { limiter } from "../middleware/rateLimit";

const router = Router();

router.get("/reports", requireAuth, requireRole("admin", "moderator"), getPendingReports);

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

const InvalidateCacheSchema = z.object({
    drugIds: z.array(z.string()).optional().default([]),
    batchNumbers: z.array(z.string()).optional().default([]),
});

router.post(
    "/cache/invalidate",
    requireAuth,
    requireRole("admin", "moderator"),
    limiter,
    async (req: Request, res: Response) => {
        try {
            const parsed = InvalidateCacheSchema.safeParse(req.body);

            if (!parsed.success) {
                res.status(400).json({
                    success: false,
                    error: "Invalid payload format",
                });
                return;
            }

            const { drugIds, batchNumbers } = parsed.data;

            if (drugIds.length > 0) {
                await invalidateDrugCache(drugIds);
            }

            if (batchNumbers.length > 0 && redisClient.isOpen) {
                const keys = batchNumbers.map(
                    (batch: string) => `${KEY_PREFIXES.DRUG_CACHE}${batch.replace(/[\r\n]/g, "")}`
                );

                await redisClient.del(keys);
            }

            res.status(200).json({
                success: true,
                message: "Cache invalidated successfully",
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
