import { Router, Request, Response } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import {
    getPendingReports,
    updateReportStatus,
    getAllMedicines,
    createMedicine,
    getAuditLogs,
} from "../controllers/admin.controller";
import { invalidateDrugCache, KEY_PREFIXES } from "../services/cache.service";
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

router.post(
    "/cache/invalidate",
    requireAuth,
    requireRole("admin", "moderator"),
    async (req: Request, res: Response) => {
        try {
            const { drugIds = [], batchNumbers = [] } = req.body;

            if (drugIds.length > 0) {
                await invalidateDrugCache(drugIds);
            }

            if (batchNumbers.length > 0 && redisClient.isOpen) {
                const keys = batchNumbers.map(
                    (batch: string) => `${KEY_PREFIXES.DRUG_CACHE}${batch}`
                );
                await redisClient.del(keys);
            }

            res.status(200).json({ success: true, message: "Cache invalidated successfully" });
        } catch (err) {
            res.status(500).json({ success: false, error: (err as Error).message });
        }
    }
);

export default router;
