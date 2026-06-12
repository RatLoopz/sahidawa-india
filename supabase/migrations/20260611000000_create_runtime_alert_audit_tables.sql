-- =============================================================================
-- SahiDawa - Runtime alert and audit tables
-- =============================================================================
-- These tables are used by the Express runtime but were previously present only
-- in apps/api/src/db/schema.sql. Keep this migration idempotent so existing
-- environments can apply it safely.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Official drug alerts used by /api/v1/alerts and /api/v1/alerts/ingest.
CREATE TABLE IF NOT EXISTS public.drug_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id UUID REFERENCES public.medicines(id),
  reported_brand_name VARCHAR(255),
  manufacturer VARCHAR(255),
  batch_number VARCHAR(100),
  alert_type VARCHAR(100),
  risk_level VARCHAR(50) DEFAULT 'high',
  district VARCHAR(100),
  state VARCHAR(100),
  source_url TEXT,
  reported_at DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drug_alerts_batch
  ON public.drug_alerts(batch_number);

CREATE INDEX IF NOT EXISTS idx_drug_alerts_created_at
  ON public.drug_alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_drug_alerts_medicine_id
  ON public.drug_alerts(medicine_id);

CREATE INDEX IF NOT EXISTS idx_drug_alerts_state_trgm
  ON public.drug_alerts
  USING gin (state gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_drug_alerts_reported_brand_name_trgm
  ON public.drug_alerts
  USING gin (reported_brand_name gin_trgm_ops);

-- 2. Admin audit log written by admin moderation and medicine workflows.
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id UUID NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_target
  ON public.audit_logs(target_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id
  ON public.audit_logs(admin_id);

-- 3. District-level alerts upserted by admin report moderation.
CREATE TABLE IF NOT EXISTS public.district_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  alert_level VARCHAR(20) DEFAULT 'medium',
  medicine_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Required by admin.controller.ts upsert({ ... }, { onConflict: "district" }).
CREATE UNIQUE INDEX IF NOT EXISTS idx_district_alerts_district_unique
  ON public.district_alerts(district);

CREATE INDEX IF NOT EXISTS idx_district_alerts_active
  ON public.district_alerts(is_active, created_at DESC);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE public.drug_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.district_alerts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'drug_alerts'
      AND policyname = 'drug_alerts_public_read'
  ) THEN
    CREATE POLICY "drug_alerts_public_read"
      ON public.drug_alerts
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'drug_alerts'
      AND policyname = 'drug_alerts_service_write'
  ) THEN
    CREATE POLICY "drug_alerts_service_write"
      ON public.drug_alerts
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_logs'
      AND policyname = 'audit_logs_service_only'
  ) THEN
    CREATE POLICY "audit_logs_service_only"
      ON public.audit_logs
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'district_alerts'
      AND policyname = 'district_alerts_service_only'
  ) THEN
    CREATE POLICY "district_alerts_service_only"
      ON public.district_alerts
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
