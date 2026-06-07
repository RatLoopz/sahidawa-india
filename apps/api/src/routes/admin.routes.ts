import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import {
    getPendingReports,
    updateReportStatus,
    getAllMedicines,
    createMedicine,
    getAuditLogs,
} from "../controllers/admin.controller";
import { getPushNotificationAnalytics } from "./analytics";

const router = Router();

router.use(requireAuth, requireRole("admin", "moderator"));

router.get("/reports", getPendingReports);
router.patch("/reports/:id/status", updateReportStatus);
router.get("/medicines", getAllMedicines);
router.post("/medicines", createMedicine);
router.get("/logs", getAuditLogs);
router.get("/push-notifications/analytics", getPushNotificationAnalytics);

export default router;
