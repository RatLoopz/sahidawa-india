-- =============================================================================
-- SahiDawa — Web Push Notification Delivery Analytics
-- =============================================================================
-- Stores one event for each attempted browser push delivery. Raw endpoints are
-- intentionally not copied here; endpoint_hash plus endpoint_host are enough for
-- aggregate analytics and failure triage without duplicating subscription data.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.push_notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id TEXT,
  notification_type TEXT NOT NULL DEFAULT 'recall_alert',
  endpoint_hash TEXT NOT NULL,
  endpoint_host TEXT NOT NULL DEFAULT 'unknown',
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  http_status INTEGER CHECK (http_status IS NULL OR (http_status BETWEEN 100 AND 599)),
  failure_reason TEXT,
  error_code TEXT,
  error_name TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_notification_events_occurred_at
  ON public.push_notification_events(occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_notification_events_status_occurred_at
  ON public.push_notification_events(status, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_notification_events_failure_reason
  ON public.push_notification_events(failure_reason)
  WHERE status = 'failed';

CREATE INDEX IF NOT EXISTS idx_push_notification_events_http_status
  ON public.push_notification_events(http_status)
  WHERE status = 'failed' AND http_status IS NOT NULL;

ALTER TABLE public.push_notification_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'push_notification_events'
      AND policyname = 'push_notification_events_service_only'
  ) THEN
    CREATE POLICY "push_notification_events_service_only"
      ON public.push_notification_events
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
