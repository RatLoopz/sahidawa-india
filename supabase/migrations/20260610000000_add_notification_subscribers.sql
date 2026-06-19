-- =============================================================================
-- SahiDawa — Notification Subscribers Schema & Policies
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notification_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    country_code TEXT NOT NULL DEFAULT '+91',
    channels TEXT[] NOT NULL DEFAULT '{whatsapp}',
    language TEXT NOT NULL DEFAULT 'en',
    district TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(phone)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_subs_district ON public.notification_subscribers(district);
CREATE INDEX IF NOT EXISTS idx_subs_language ON public.notification_subscribers(language);

-- Extend existing tables to track notification broadcast states
ALTER TABLE public.district_alerts ADD COLUMN IF NOT EXISTS broadcasted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.drug_alerts ADD COLUMN IF NOT EXISTS broadcasted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS expiry_broadcasted BOOLEAN NOT NULL DEFAULT FALSE;

-- Row Level Security
ALTER TABLE public.notification_subscribers ENABLE ROW LEVEL SECURITY;

-- 1. Authenticated users can manage only their own subscriptions
CREATE POLICY "notification_subscribers_user_all"
    ON public.notification_subscribers
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 2. Service role (Express API backend) can manage all subscriptions
CREATE POLICY "notification_subscribers_service_role"
    ON public.notification_subscribers
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
