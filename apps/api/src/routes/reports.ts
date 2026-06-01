import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../db/client';
import {
  AuthenticatedRequest,
  optionalAuth,
  requireAuth,
  requireRole,
} from '../middleware/auth';

const reportsRouter = Router();

// Blocked hostname patterns for image URL SSRF protection.
// z.string().url() only validates URL format, not destination.
// An attacker could supply cloud metadata or internal service URLs that may be
// fetched server-side when the image is processed.
const BLOCKED_IMAGE_URL_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

function isPublicImageUrl(rawUrl: string): boolean {
  try {
    const { protocol, hostname } = new URL(rawUrl);
    if (protocol !== 'https:' && protocol !== 'http:') return false;
    return !BLOCKED_IMAGE_URL_PATTERNS.some((p) => p.test(hostname));
  } catch {
    return false;
  }
}

const safeImageUrl = z
  .string()
  .url()
  .refine(isPublicImageUrl, {
    message:
      'Image URL must use http(s) and must not point to a private, loopback, or link-local address',
  });

const createReportSchema = z.object({
  medicineName: z.string().min(2),
  manufacturer: z.string().min(2),
  description: z.string().min(20),
  images: z.array(safeImageUrl).min(1),
  pharmacyName: z.string().min(2),
  address: z.string().min(5),
  city: z.string().min(2),
  state: z.string().min(2),
  pincode: z.string().regex(/^\d{6}$/),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const buildReportLocation = (latitude?: number, longitude?: number) => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return null;
  }

  return `POINT(${longitude} ${latitude})`;
};

reportsRouter.post('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = createReportSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid report payload',
      issues: parsed.error.issues,
    });
    return;
  }

  const data = parsed.data;

  const { data: report, error } = await supabase
    .from('counterfeit_reports')
    .insert({
      reported_brand_name: data.medicineName,
      manufacturer: data.manufacturer,
      description: data.description,
      photo_url: data.images[0],
      photo_urls: data.images,
      pharmacy_name: data.pharmacyName,
      address: data.address,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      district: data.city,
      report_location: buildReportLocation(data.latitude, data.longitude),
      reporter_id: req.user?.id ?? null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: 'Failed to submit counterfeit report' });
    return;
  }

  res.status(201).json({ report });
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
