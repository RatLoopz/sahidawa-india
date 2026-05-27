import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import {
  getPendingReports,
  updateReportStatus,
  getAllMedicines,
  createMedicine,
} from '../controllers/admin.controller';

const router = Router();

router.use(requireAuth, requireRole('admin', 'moderator'));

router.get('/reports', getPendingReports);
router.patch('/reports/:id/status', updateReportStatus);
router.get('/medicines', getAllMedicines);
router.post('/medicines', createMedicine);

export default router;
