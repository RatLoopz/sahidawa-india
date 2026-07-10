-- =============================================================================
-- SahiDawa - Store aggregated rate-limit metrics snapshots
-- =============================================================================
-- Hourly background jobs write Redis rate-limit aggregates here so the admin
-- dashboard can read from Postgres instead of scanning Redis at request time.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_metrics (
  id BIGSERIAL PRIMARY KEY,
  snapshot_id UUID NOT NULL,
  ip_address TEXT NOT NULL,
  rate_limit_key TEXT,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  window_seconds INTEGER NOT NULL DEFAULT 60 CHECK (window_seconds > 0),
  window_start TIMESTAMPTZ NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_otp_metric BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ip_address, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_metrics_snapshot
  ON public.rate_limit_metrics (snapshot_id);

CREATE INDEX IF NOT EXISTS idx_rate_limit_metrics_captured_at
  ON public.rate_limit_metrics (captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limit_metrics_request_count
  ON public.rate_limit_metrics (request_count DESC);

ALTER TABLE public.rate_limit_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rate_limit_metrics_admin_read" ON public.rate_limit_metrics;
CREATE POLICY "rate_limit_metrics_admin_read"
  ON public.rate_limit_metrics
  FOR SELECT
  TO authenticated
  USING (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'moderator')
    OR COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') IN ('admin', 'moderator')
  );

DROP POLICY IF EXISTS "rate_limit_metrics_service_role_all" ON public.rate_limit_metrics;
CREATE POLICY "rate_limit_metrics_service_role_all"
  ON public.rate_limit_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
