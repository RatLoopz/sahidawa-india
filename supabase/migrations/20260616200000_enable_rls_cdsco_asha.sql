-- =============================================================================
-- SahiDawa — Enable Row Level Security for CDSCO Reference & ASHA Workers
-- =============================================================================
-- WHY THIS EXISTS:
--   The cdsco_reference and asha_workers tables currently do not have
--   Row Level Security enabled.
--
--   Without RLS, clients using the Supabase anon key may be able to
--   query, insert, update, or delete rows directly, bypassing intended
--   backend validation and access controls.
--
--   This migration enables RLS and allows:
--   - anon/authenticated users: read-only access
--   - service_role: full access for backend and ETL operations
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CDSCO REFERENCE TABLE
--    Public users can read.
--    service_role retains full access.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cdsco_reference ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to cdsco_reference" ON public.cdsco_reference
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Service role full access to cdsco_reference" ON public.cdsco_reference
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ASHA WORKERS TABLE
--    Public users can read.
--    service_role retains full access.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.asha_workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to asha_workers" ON public.asha_workers
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Service role full access to asha_workers" ON public.asha_workers
  FOR ALL TO service_role USING (true) WITH CHECK (true);