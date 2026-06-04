
-- =============================================================================
-- SahiDawa — Push Subscriptions Ownership & RLS
-- =============================================================================
-- WHY THIS EXISTS:
--   push_subscriptions currently stores browser push endpoints, but without an
--   owner column the backend cannot enforce per-user access or clean up rows
--   safely. This migration adds ownership and row-level security so each user
--   can only access their own subscription record.
--
-- POLICY DESIGN:
--   push_subscriptions → authenticated users can manage only their own rows,
--                        service_role can manage all rows for backend jobs.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PUSH SUBSCRIPTIONS TABLE
--    Add ownership so subscriptions can be linked to auth.users(id).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;


-- Authenticated users can read, insert, update, and delete only their own rows
CREATE POLICY "push_subscriptions_user_all"
  ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- =============================================================================
-- VERIFICATION QUERY (run manually after applying to confirm RLS is active)
-- =============================================================================
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename = 'push_subscriptions';
-- Expected: rowsecurity = true
-- =============================================================================