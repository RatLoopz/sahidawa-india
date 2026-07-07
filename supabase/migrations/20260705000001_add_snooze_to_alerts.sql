-- =============================================================================
-- Add snoozed_until to drug_alerts and counterfeit_reports
-- =============================================================================

ALTER TABLE public.drug_alerts
ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_drug_alerts_snoozed_until ON public.drug_alerts (snoozed_until);

ALTER TABLE public.counterfeit_reports
ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_reports_snoozed_until ON public.counterfeit_reports (snoozed_until);
