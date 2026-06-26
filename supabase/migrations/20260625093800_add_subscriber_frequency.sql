-- Migration: Add preference_frequency column to notification_subscribers

ALTER TABLE public.notification_subscribers
  ADD COLUMN IF NOT EXISTS preference_frequency TEXT
    NOT NULL
    DEFAULT 'immediate'
    CHECK (preference_frequency IN ('immediate', 'daily', 'weekly', 'monthly'));

COMMENT ON COLUMN public.notification_subscribers.preference_frequency IS
  'Controls how often a subscriber receives expiry digest alerts.
   immediate = send as soon as the broadcaster runs (legacy behaviour),
   daily     = bundle into one message per calendar day,
   weekly    = bundle into one message per ISO calendar week,
   monthly   = bundle into one message per calendar month.
   Counterfeit and recall alerts are always sent immediately regardless of this setting.';

-- Index to make the frequency-filtered subscriber query fast
CREATE INDEX IF NOT EXISTS idx_notification_subscribers_frequency
  ON public.notification_subscribers (preference_frequency)
  WHERE is_active = TRUE;