import { Router, Request, Response } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import {
    getPendingReports,
    updateReportStatus,
    getAllMedicines,
    createMedicine,
    getAuditLogs,
} from "../controllers/admin.controller";
import { invalidateDrugCache, getCacheStats, KEY_PREFIXES } from "../services/cache.service";
import { redisClient } from "../utils/redis";
import { getPushNotificationAnalytics } from "./analytics";

const router = Router();

router.get("/reports", requireAuth, requireRole("admin", "moderator"), getPendingReports);

router.get("/medicines", requireAuth, requireRole("admin", "moderator"), getAllMedicines);

router.get("/logs", requireAuth, requireRole("admin", "moderator"), getAuditLogs);

router.get(
    "/push-notifications/analytics",
    requireAuth,
    requireRole("admin", "moderator"),
    getPushNotificationAnalytics
);

router.patch("/reports/:id/status", requireAuth, requireRole("admin"), updateReportStatus);

router.post("/medicines", requireAuth, requireRole("admin"), createMedicine);

import { z } from "zod";

const InvalidateCacheSchema = z.object({
    drugIds: z.array(z.string()).optional().default([]),
    batchNumbers: z.array(z.string()).optional().default([]),
});

router.post(
    "/cache/invalidate",
    requireAuth,
    requireRole("admin", "moderator"),
    async (req: Request, res: Response) => {
        try {
            const parsed = InvalidateCacheSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({ success: false, error: "Invalid payload format" });
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

            res.status(200).json({ success: true, message: "Cache invalidated successfully" });
        } catch (err) {
            res.status(500).json({ success: false, error: (err as Error).message });
        }
    }
);

router.get(
    "/cache/stats",
    requireAuth,
    requireRole("admin", "moderator"),
    async (req: Request, res: Response) => {
        try {
            const stats = await getCacheStats();
            res.status(200).json({ success: true, data: stats });
        } catch (err) {
            res.status(500).json({ success: false, error: (err as Error).message });
        }
    }
);

export default router;
