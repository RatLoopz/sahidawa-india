CREATE TABLE IF NOT EXISTS public.user_scan_history (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    scanned_at TIMESTAMPTZ NOT NULL,
    query TEXT NOT NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL,
    brand_name TEXT,
    generic_name TEXT,
    manufacturer TEXT,
    batch_number TEXT,
    expiry_date TEXT,
    cdsco_approval_status TEXT,
    is_counterfeit_alert BOOLEAN,
    message TEXT,
    scan_meta JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_scan_history_user_scanned_at
    ON public.user_scan_history(user_id, scanned_at DESC);

ALTER TABLE public.user_scan_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_scan_history_owner_select" ON public.user_scan_history;
CREATE POLICY "user_scan_history_owner_select"
    ON public.user_scan_history
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_scan_history_owner_insert" ON public.user_scan_history;
CREATE POLICY "user_scan_history_owner_insert"
    ON public.user_scan_history
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_scan_history_owner_update" ON public.user_scan_history;
CREATE POLICY "user_scan_history_owner_update"
    ON public.user_scan_history
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_scan_history_owner_delete" ON public.user_scan_history;
CREATE POLICY "user_scan_history_owner_delete"
    ON public.user_scan_history
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
