-- Migration: Add per-frequency expiry digest delivery tracking
--
-- Before this migration, batches.expiry_broadcasted was the only delivery
-- state for expiry alerts. It is a single global boolean, so the first
-- successful delivery (e.g. to an "immediate" subscriber) permanently removed
-- the batch from every later run and "weekly"/"monthly" subscribers never
-- received their scheduled digest.
--
-- This table records, per batch and per digest frequency, the last time the
-- batch was included in a delivered expiry digest. It lets each frequency
-- window advance independently: a batch is pending for a frequency when there
-- is no row (or the row's sent_at falls before that frequency's current
-- window). Immediate delivery state continues to live on
-- batches.expiry_broadcasted, so no backfill is required.

CREATE TABLE IF NOT EXISTS public.expiry_digest_deliveries (
    batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (batch_id, frequency)
);

-- Lookup used by the broadcaster: "which batches were already delivered for
-- this frequency inside the current window?".
CREATE INDEX IF NOT EXISTS idx_expiry_digest_deliveries_frequency_sent_at
    ON public.expiry_digest_deliveries (frequency, sent_at DESC);

COMMENT ON TABLE public.expiry_digest_deliveries IS
  'Tracks the last delivery of each expiring batch per digest frequency so daily/weekly/monthly expiry digests operate independently. Immediate deliveries are tracked by batches.expiry_broadcasted.';

ALTER TABLE public.expiry_digest_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expiry_digest_deliveries_service_only"
    ON public.expiry_digest_deliveries
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
