-- =============================================================================
-- SahiDawa — Row Level Security Policies for Scan History
-- =============================================================================
-- WHY THIS EXISTS:
--   The scan_history table tracks duplicate scan anomaly detection.
--   Without RLS, anyone who knows the Supabase anon key can read, modify, or
--   delete scan logs.
--   This migration enables RLS on the scan_history table and restricts all
--   read/write access to the administrative service_role key used by the backend.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SCAN HISTORY TABLE
--    Read/write restricted to service_role (the Express API backend uses service key).
--    Anonymous/authenticated roles are blocked from all operations.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scan_history_service_only"
  ON public.scan_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
