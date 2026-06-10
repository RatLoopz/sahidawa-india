import { Router } from "express";
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
import { getPushNotificationAnalytics } from "./analytics";

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

export default router;
