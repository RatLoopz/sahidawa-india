-- =============================================================================
-- SahiDawa — Expiry Tracker Items Table
-- =============================================================================
-- WHY THIS EXISTS:
--   Authenticated users need persistent, cross-device storage for their tracked
--   medicine expiry records. Guest/anonymous users continue to use localStorage.
--
-- DESIGN:
--   expiry_tracker_items → owner-only read/write via RLS (user_id = auth.uid())
--   service_role         → full access for administrative / backup jobs
--
-- INDEXES:
--   user_id    → fast filtering of a user's own records
--   expiry_date → efficient sorting/filtering by approaching expiry
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.expiry_tracker_items (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_name   TEXT        NOT NULL,
    batch_number TEXT,
    expiry_date  DATE        NOT NULL,
    notes        TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.expiry_tracker_items ENABLE ROW LEVEL SECURITY;

-- 2a. Authenticated users: full CRUD on their own rows only
CREATE POLICY "expiry_tracker_items_owner_policy"
    ON public.expiry_tracker_items
    FOR ALL
    TO authenticated
    USING     (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 2b. Service role: unrestricted access for admin / backup jobs
CREATE POLICY "expiry_tracker_items_service_policy"
    ON public.expiry_tracker_items
    FOR ALL
    TO service_role
    USING     (true)
    WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. INDEXES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_expiry_tracker_items_user_id
    ON public.expiry_tracker_items (user_id);

CREATE INDEX IF NOT EXISTS idx_expiry_tracker_items_expiry_date
    ON public.expiry_tracker_items (expiry_date);

-- =============================================================================
-- VERIFICATION QUERY (run manually after applying to confirm RLS is active)
-- =============================================================================
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public' AND tablename = 'expiry_tracker_items';
-- Expected: rowsecurity = true
-- =============================================================================
