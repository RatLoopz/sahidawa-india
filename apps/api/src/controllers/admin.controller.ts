import { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../db/client';
import { logAdminAction } from '../services/audit.service';

const reportStatusSchema = z.object({
  status: z.enum(['pending', 'verified_fake', 'false_alarm']),
});

const medicineSchema = z.object({
  brand_name: z.string().min(1),
  generic_name: z.string().min(1),
  manufacturer: z.string().min(1),
  barcode_id: z.string().optional(),
  cdsco_approval_status: z.enum(['approved', 'recalled', 'banned']).default('approved'),
});

export const getPendingReports = async (req: Request, res: Response): Promise<void> => {
  const { data, error } = await supabase
    .from('counterfeit_reports')
    .select('*, medicines(brand_name, generic_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: 'Failed to fetch reports' });
    return;
  }

  res.json({ reports: data });
};

export const updateReportStatus = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const parsed = reportStatusSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid status', details: parsed.error.issues });
    return;
  }

  const { status } = parsed.data;

  const { data, error } = await supabase
    .from('counterfeit_reports')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: 'Failed to update report' });
    return;
  }

  if (!data) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  await logAdminAction(req.user.id, `STATUS_${status.toUpperCase()}`, 'REPORT', id, { status });

  if (status === 'verified_fake' && data.district) {
    const { count } = await supabase
      .from('counterfeit_reports')
      .select('*', { count: 'exact', head: true })
      .eq('district', data.district)
      .eq('status', 'verified_fake');

    if (count && count >= 3) {
      await supabase.from('district_alerts').insert({
        district: data.district,
        medicine_name: data.reported_brand_name,
        alert_level: count >= 10 ? 'high' : 'medium',
      });
    }
  }

  res.json({ message: 'Report updated', report: data });
};

export const getAllMedicines = async (_req: Request, res: Response): Promise<void> => {
  const { data, error } = await supabase.from('medicines').select('*').limit(50);

  if (error) {
    res.status(500).json({ error: 'Failed to fetch medicines' });
    return;
  }

  res.json(data);
};

export const createMedicine = async (req: Request, res: Response): Promise<void> => {
  const parsed = medicineSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid data', details: parsed.error.issues });
    return;
  }

  const { data, error } = await supabase
    .from('medicines')
    .insert(parsed.data)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: 'Failed to create medicine' });
    return;
  }

  await logAdminAction(req.user.id, 'CREATE_MEDICINE', 'MEDICINE', data.id, parsed.data);
  res.status(201).json(data);
};
