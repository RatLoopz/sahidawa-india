import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';
import {
  getPendingReports,
  updateReportStatus,
  getAllMedicines,
  createMedicine,
} from '../controllers/admin.controller';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/reports', getPendingReports);
router.patch('/reports/:id/status', updateReportStatus);
router.get('/medicines', getAllMedicines);
router.post('/medicines', createMedicine);

export default router;
