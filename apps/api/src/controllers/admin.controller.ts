import { Response } from 'express';
import { z } from 'zod';
import { supabase } from '../db/client';
import { logAdminAction } from '../services/audit.service';
import { AuthenticatedRequest } from '../middleware/auth';

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

export const getPendingReports = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
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
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateReportStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
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

    await logAdminAction(req.user!.id, `STATUS_${status.toUpperCase()}`, 'REPORT', id as string, { status });

    // --- DISTRICT ALERT LOGIC ---
    if (status === 'verified_fake' && data.district) {
      const { count } = await supabase
        .from('counterfeit_reports')
        .select('*', { count: 'exact', head: true })
        .eq('district', data.district)
        .eq('status', 'verified_fake');

      if (count && count >= 3) {
        const alertLevel = count >= 10 ? 'high' : 'medium';

        const { data: existingAlert } = await supabase
          .from('district_alerts')
          .select('id, alert_level')
          .eq('district', data.district)
          .maybeSingle();

        if (!existingAlert) {
          // Create new alert if none exists
          await supabase.from('district_alerts').insert({
            district: data.district,
            medicine_name: data.reported_brand_name,
            alert_level: alertLevel
          });
        } else if (existingAlert.alert_level !== alertLevel) {
          // Upgrade the alert level if the count threshold changed
          await supabase.from('district_alerts')
            .update({ alert_level: alertLevel })
            .eq('id', existingAlert.id);
        }
      }
    }

    res.json({ message: 'Status updated', report: data });
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllMedicines = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase.from('medicines').select('*').limit(50);
    
    if (error) {
      res.status(500).json({ error: 'Failed to fetch medicines' });
      return;
    }
    
    res.json({ medicines: data });
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createMedicine = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = medicineSchema.safeParse(req.body);
    
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid medicine data', details: parsed.error.issues });
      return;
    }

    const { data, error } = await supabase
      .from('medicines')
      .insert(parsed.data)
      .select()
      .single();

    if (error || !data) {
      res.status(500).json({ error: 'Failed to create medicine' });
      return;
    }

    await logAdminAction(req.user!.id, 'CREATE_MEDICINE', 'MEDICINE', data.id, parsed.data);
    res.status(201).json(data);
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' });
  }
};