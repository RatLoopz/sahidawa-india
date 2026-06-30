-- =============================================================================
-- Add pending_verification status and OTP columns to notification_subscribers
-- =============================================================================

ALTER TABLE public.notification_subscribers
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.notification_subscribers
ADD COLUMN IF NOT EXISTS verification_otp TEXT,
ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP WITH TIME ZONE;

-- Create an index for fast OTP lookups
CREATE INDEX IF NOT EXISTS idx_subs_verification_otp ON public.notification_subscribers(verification_otp);
