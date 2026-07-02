-- Track idempotency keys server-side as a backstop to Redis
CREATE TABLE IF NOT EXISTS public.submission_idempotency (
  idempotency_key   TEXT PRIMARY KEY,
  scan_id           TEXT REFERENCES public.user_scan_history(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-part sync status for a scan submission
CREATE TABLE IF NOT EXISTS public.scan_submission_parts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id           TEXT NOT NULL REFERENCES public.user_scan_history(id) ON DELETE CASCADE,
  part_type         TEXT NOT NULL CHECK (part_type IN ('metadata', 'image', 'voice')),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'failed')),
  attempt_count     INT NOT NULL DEFAULT 0,
  last_error        TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create a unique constraint for upsert
ALTER TABLE public.scan_submission_parts ADD CONSTRAINT uq_scan_id_part_type UNIQUE (scan_id, part_type);

-- Audit log for conflict resolution
CREATE TABLE IF NOT EXISTS public.scan_conflict_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id           TEXT NOT NULL REFERENCES public.user_scan_history(id) ON DELETE CASCADE,
  device_id         TEXT NOT NULL,
  attempted_payload JSONB NOT NULL,
  resolution        TEXT NOT NULL, -- 'applied' | 'rejected_stale'
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure user_scan_history table can detect conflicting writes
ALTER TABLE public.user_scan_history ADD COLUMN IF NOT EXISTS client_updated_at TIMESTAMPTZ;
ALTER TABLE public.user_scan_history ADD COLUMN IF NOT EXISTS device_id TEXT;

-- RLS policies for submission_idempotency
ALTER TABLE public.submission_idempotency ENABLE ROW LEVEL SECURITY;
CREATE POLICY "submission_idempotency_owner" ON public.submission_idempotency
    FOR ALL TO authenticated
    USING (
        scan_id IN (SELECT id FROM public.user_scan_history WHERE user_id = auth.uid())
    )
    WITH CHECK (
        scan_id IN (SELECT id FROM public.user_scan_history WHERE user_id = auth.uid())
    );

-- RLS policies for scan_submission_parts
ALTER TABLE public.scan_submission_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scan_submission_parts_owner" ON public.scan_submission_parts
    FOR ALL TO authenticated
    USING (
        scan_id IN (SELECT id FROM public.user_scan_history WHERE user_id = auth.uid())
    )
    WITH CHECK (
        scan_id IN (SELECT id FROM public.user_scan_history WHERE user_id = auth.uid())
    );

-- RLS policies for scan_conflict_log
ALTER TABLE public.scan_conflict_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scan_conflict_log_owner" ON public.scan_conflict_log
    FOR ALL TO authenticated
    USING (
        scan_id IN (SELECT id FROM public.user_scan_history WHERE user_id = auth.uid())
    )
    WITH CHECK (
        scan_id IN (SELECT id FROM public.user_scan_history WHERE user_id = auth.uid())
    );
