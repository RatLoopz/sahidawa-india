import { Router, Response } from 'express';
import { supabase } from '../db/client';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/auth';

const reportsRouter = Router();

interface CreateReportBody {
  medicineId?: string;
  scannedBarcode?: string;
  reportedBrandName?: string;
  photoUrl?: string;
  latitude?: number;
  longitude?: number;
  district?: string;
}

const buildReportLocation = (latitude?: number, longitude?: number) => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return null;
  }

  return `POINT(${longitude} ${latitude})`;
};

reportsRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const {
    medicineId,
    scannedBarcode,
    reportedBrandName,
    photoUrl,
    latitude,
    longitude,
    district,
  } = req.body as CreateReportBody;

  if (!scannedBarcode && !reportedBrandName && !medicineId) {
    res.status(400).json({
      error: 'At least one medicine identifier is required',
    });
    return;
  }

  const { data, error } = await supabase
    .from('counterfeit_reports')
    .insert({
      medicine_id: medicineId,
      scanned_barcode: scannedBarcode,
      reported_brand_name: reportedBrandName,
      photo_url: photoUrl,
      report_location: buildReportLocation(latitude, longitude),
      district,
      status: 'pending',
      // `requireAuth` guarantees `req.user` is set; the `?? null` fallback is
      // a safety net so the column accepts the historical anonymous shape if
      // the middleware contract is ever relaxed.
      reporter_id: req.user?.id ?? null,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: 'Failed to submit counterfeit report' });
    return;
  }

  res.status(201).json({ report: data, submittedBy: req.user?.id });
});

// Must be registered BEFORE the admin-only GET '/' so Express matches /mine first.
reportsRouter.get('/mine', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }

  const { data, error } = await supabase
    .from('counterfeit_reports')
    .select('id, reported_brand_name, scanned_barcode, photo_url, district, status, created_at')
    .eq('reporter_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: 'Failed to fetch your reports' });
    return;
  }

  res.json({ reports: data ?? [] });
});

reportsRouter.get('/', requireAuth, requireRole('admin'), async (_req, res: Response) => {
  const { data, error } = await supabase
    .from('counterfeit_reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: 'Failed to fetch counterfeit reports' });
    return;
  }

  res.json({ reports: data });
});

reportsRouter.patch('/:id/status', requireAuth, requireRole('admin'), async (req, res: Response) => {
  const { status } = req.body as { status?: string };
  const allowedStatuses = ['pending', 'verified_fake', 'false_alarm'];

  if (!status || !allowedStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid report status' });
    return;
  }

  const { data, error } = await supabase
    .from('counterfeit_reports')
    .update({ status })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: 'Failed to update report status' });
    return;
  }

  res.json({ report: data });
});

export default reportsRouter;
