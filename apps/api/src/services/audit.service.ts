import { supabase } from '../db/client';

export const logAdminAction = async (
  adminId: string,
  action: string,
  targetType: 'REPORT' | 'MEDICINE',
  targetId: string,
  details: Record<string, unknown>
) => {
  const { error } = await supabase.from('audit_logs').insert({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId,
    details,
  });

  if (error) {
    console.error('[audit] Failed to write log:', error.message);
  }
};
