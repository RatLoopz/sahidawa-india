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

        // Replace the previous check-then-insert pattern with a single upsert.
        // The old pattern had a TOCTOU race window: two concurrent admin actions
        // on the same district could both pass the existingAlert check and
        // produce duplicate rows. The upsert with onConflict is atomic and
        // eliminates the window. The conflict target must match a unique
        // constraint on (district) in the district_alerts table.
        await supabase
          .from('district_alerts')
          .upsert(
            {
              district: data.district,
              medicine_name: data.reported_brand_name,
              alert_level: alertLevel,
            },
            { onConflict: 'district' }
          );
      }
    }

    res.json({ message: 'Status updated', report: data });
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllMedicines = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // 1. Parse query parameters with fallbacks
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    
    // 2. Calculate the offset for Supabase
    const offset = (page - 1) * limit;

    // 3. Fetch data and total count using .range() instead of .limit()
    const { data, error, count } = await supabase
      .from('medicines')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1);
    
    if (error) {
      res.status(500).json({ error: 'Failed to fetch medicines' });
      return;
    }
    
    // 4. Return data along with pagination metadata so the frontend knows what to do
    res.json({ 
      medicines: data,
      meta: {
        total: count || 0,
        page,
        limit,
        totalPages: count ? Math.ceil(count / limit) : 0
      }
    });
  } catch (err) {
    console.error('Error in getAllMedicines:', err);
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

export const getAuditLogs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      res.status(500).json({ error: 'Failed to fetch audit logs' });
      return;
    }

    const formatDetails = (log: any): string => {
      if (!log.details) return log.action;
      try {
        const detailsObj = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
        if (log.action.startsWith('STATUS_')) {
          return `Updated report status to ${detailsObj.status || 'unknown'}`;
        }
        if (log.action === 'CREATE_MEDICINE') {
          return `Created new medicine: ${detailsObj.brand_name || 'unknown'} (${detailsObj.generic_name || 'unknown'})`;
        }
        return `${log.action}: ${JSON.stringify(detailsObj)}`;
      } catch (e) {
        return log.action;
      }
    };

    const formattedLogs = (data || []).map((log: any) => ({
      ...log,
      details: formatDetails(log)
    }));

    res.json({
      logs: formattedLogs,
      meta: {
        total: count || 0,
        page,
        limit,
        totalPages: count ? Math.ceil(count / limit) : 0
      }
    });
  } catch (err) {
    console.error('Error in getAuditLogs:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};