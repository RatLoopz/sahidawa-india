-- =============================================================================
-- SahiDawa — Enable RLS on tracked_medicines
-- =============================================================================
-- WHY THIS EXISTS:
--   tracked_medicines was created in 20260615100000_add_tracked_medicines.sql
--   without ALTER TABLE … ENABLE ROW LEVEL SECURITY and without any
--   CREATE POLICY statements. This migration closes that gap by applying
--   the same per-user ownership pattern used by counterfeit_reports.
--
-- POLICY DESIGN:
--   tracked_medicines has a user_id column (UUID REFERENCES auth.users(id)).
--   Authenticated users can read/write only their own rows.
--   Service role (backend) retains full access for admin/notification tasks.
--   Anonymous/guest access via session_id is NOT covered here — the table
--   has no anon-friendly RLS path yet. If guest-tracking is needed, a
--   future policy branch based on session_id should be added.
-- =============================================================================

ALTER TABLE public.tracked_medicines ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read/write only their own tracked medicines
CREATE POLICY "tracked_medicines_owner_only"
  ON public.tracked_medicines
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role (backend) can do anything (notifications, admin, ETL)
CREATE POLICY "tracked_medicines_service_all"
  ON public.tracked_medicines
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
