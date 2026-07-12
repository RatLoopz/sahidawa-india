-- Create webhook_logs table to capture database-level webhook/trigger events
CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    table_name TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grant full access to service_role and postgres (needed for CI/E2E tests)
GRANT ALL ON TABLE public.webhook_logs TO service_role;
GRANT ALL ON TABLE public.webhook_logs TO postgres;
-- Allow read-only access for authenticated users (for admin dashboards etc.)
GRANT SELECT ON TABLE public.webhook_logs TO authenticated;

-- RLS: enable but allow service_role unrestricted access
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_webhook_logs"
ON public.webhook_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────────────────
-- Trigger function: fires on INSERT to health_schemes and writes to webhook_logs
-- This simulates a "database webhook" in the local Supabase environment where
-- pg_net HTTP calls are not available, allowing E2E tests to verify that an
-- insert into health_schemes is captured and observable via webhook_logs.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_health_scheme_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.webhook_logs (event_type, table_name, payload)
    VALUES (
        TG_OP,
        TG_TABLE_NAME,
        to_jsonb(NEW)
    );
    RETURN NEW;
END;
$$;

-- Attach trigger: fires AFTER each INSERT row on health_schemes
DROP TRIGGER IF EXISTS health_schemes_webhook_trigger ON public.health_schemes;

CREATE TRIGGER health_schemes_webhook_trigger
AFTER INSERT ON public.health_schemes
FOR EACH ROW
EXECUTE FUNCTION public.log_health_scheme_webhook();
