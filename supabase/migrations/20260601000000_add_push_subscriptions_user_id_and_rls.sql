
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
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- Legacy rows from 20260518000000_create_push_subscriptions.sql were stored
-- without an authenticated owner. There is no reliable way to infer the user
-- for those browser endpoints, and keeping ownerless rows would either fail the
-- NOT NULL enforcement below or bypass the per-user RLS model. Remove only rows
-- that are still ownerless before enforcing the ownership contract.
DELETE FROM public.push_subscriptions
WHERE user_id IS NULL;

ALTER TABLE public.push_subscriptions
  ALTER COLUMN user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'push_subscriptions_user_id_fkey'
      AND conrelid = 'public.push_subscriptions'::regclass
  ) THEN
    ALTER TABLE public.push_subscriptions
      ADD CONSTRAINT push_subscriptions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;


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
