-- =============================================================================
-- SahiDawa — Row Level Security Policies
-- =============================================================================
-- WHY THIS EXISTS:
--   Without RLS, anyone who knows the Supabase anon key (which is public in
--   client-side code) can read and write every row in every table.
--   This migration locks each table down to the minimum access needed.
--
-- POLICY DESIGN:
--   medicines          → anyone can READ (public health data), only backend writes
--   pharmacies         → anyone can READ, only backend writes
--   counterfeit_reports→ anyone can READ, authenticated users INSERT their own
--   push_subscriptions → only the owning user reads/writes (no user_id col yet → service_role only)
--   etl_failed_rows    → internal/backend only, never exposed to users
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. MEDICINES TABLE
--    Public read: citizens need to verify medicines without logging in.
--    Write restricted to service_role (the Express API backend uses service key).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;

-- Anon (unauthenticated) and authenticated users can SELECT
CREATE POLICY "medicines_public_read"
  ON public.medicines
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only the service_role key (used by backend) can INSERT / UPDATE / DELETE
CREATE POLICY "medicines_service_write"
  ON public.medicines
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PHARMACIES TABLE
--    Public read: anyone can find nearby pharmacies.
--    Write restricted to service_role (ETL pipeline loads Jan Aushadhi data).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pharmacies_public_read"
  ON public.pharmacies
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "pharmacies_service_write"
  ON public.pharmacies
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. COUNTERFEIT REPORTS TABLE
--    Public read: transparency — anyone can see reported fake medicines.
--    Authenticated INSERT: logged-in citizens can submit a report.
--    UPDATE/DELETE: only the reporter or service_role (moderators).
--    Anonymous INSERT: also allowed so citizens without accounts can report.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.counterfeit_reports ENABLE ROW LEVEL SECURITY;

-- Anyone can read reports (public heatmap data)
CREATE POLICY "reports_public_read"
  ON public.counterfeit_reports
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Authenticated users can submit their own reports
CREATE POLICY "reports_authenticated_insert"
  ON public.counterfeit_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- reporter_id must match the calling user, or be NULL (anonymous report)
    reporter_id IS NULL OR reporter_id = auth.uid()
  );

-- Anonymous users can also submit reports (reporter_id will be NULL)
CREATE POLICY "reports_anon_insert"
  ON public.counterfeit_reports
  FOR INSERT
  TO anon
  WITH CHECK (reporter_id IS NULL);

-- A reporter can update only their own reports (status changes)
CREATE POLICY "reports_owner_update"
  ON public.counterfeit_reports
  FOR UPDATE
  TO authenticated
  USING (reporter_id = auth.uid())
  WITH CHECK (reporter_id = auth.uid());

-- Service role (backend/moderators) can do anything
CREATE POLICY "reports_service_all"
  ON public.counterfeit_reports
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PUSH SUBSCRIPTIONS TABLE
--    Note: This table has no user_id column yet (added anonymously by endpoint).
--    For now: only the backend service_role can read/write subscriptions.
--    TODO: Add user_id column in a future migration to enable per-user policies.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Service_role only (the notifications API uses service_role key)
CREATE POLICY "push_subscriptions_service_only"
  ON public.push_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ETL FAILED ROWS TABLE
--    Internal ETL pipeline data — never exposed to end users.
--    Only service_role (ETL pipeline runs with service key).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.etl_failed_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "etl_failed_rows_service_only"
  ON public.etl_failed_rows
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- VERIFICATION QUERY (run manually after applying to confirm RLS is active)
-- =============================================================================
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('medicines','pharmacies','counterfeit_reports',
--                     'push_subscriptions','etl_failed_rows');
-- Expected: rowsecurity = true for all 5 rows.
-- =============================================================================
