-- =============================================================================
-- SahiDawa — Medicine Search Performance Indexes
-- =============================================================================
-- WHY THIS EXISTS:
--   The scan.ts route currently does:
--     SELECT brand_name, generic_name FROM medicines
--   ...with NO WHERE clause — fetching the ENTIRE table into memory on every scan.
--   At 100 medicines this is okay. At 10,000+ it will cause OOM crashes.
--
--   This migration adds GIN full-text search indexes and lowercase B-tree indexes
--   so the API can do targeted ILIKE searches instead of full table scans.
--
-- INDEXES CREATED:
--   1. GIN index on brand_name tsvector    → fast full-text search
--   2. GIN index on generic_name tsvector  → fast full-text search
--   3. B-tree index on lower(brand_name)   → fast ILIKE '%name%' queries
--   4. B-tree index on lower(generic_name) → fast ILIKE '%name%' queries
--   5. Composite index on (brand_name, generic_name) for list queries
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Full-Text Search (GIN) Indexes
-- Used by: to_tsvector('english', brand_name) @@ plainto_tsquery(...)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_medicines_brand_fts
  ON public.medicines
  USING gin(to_tsvector('english', brand_name));

CREATE INDEX IF NOT EXISTS idx_medicines_generic_fts
  ON public.medicines
  USING gin(to_tsvector('english', generic_name));

-- ─────────────────────────────────────────────────────────────────────────────
-- Lowercase B-tree Indexes
-- Used by: WHERE lower(brand_name) LIKE lower('%query%')
-- These make ILIKE queries fast (case-insensitive substring match)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_medicines_brand_lower
  ON public.medicines (lower(brand_name));

CREATE INDEX IF NOT EXISTS idx_medicines_generic_lower
  ON public.medicines (lower(generic_name));

-- ─────────────────────────────────────────────────────────────────────────────
-- Manufacturer Index (for ETL validation queries)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_medicines_manufacturer_lower
  ON public.medicines (lower(manufacturer));

-- ─────────────────────────────────────────────────────────────────────────────
-- CDSCO status index (for alerts homepage query)
-- Used by: WHERE cdsco_approval_status IN ('recalled', 'banned')
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_medicines_cdsco_status
  ON public.medicines (cdsco_approval_status)
  WHERE cdsco_approval_status IN ('recalled', 'banned');

-- ─────────────────────────────────────────────────────────────────────────────
-- Counterfeit alert index (for homepage alerts panel)
-- Used by: WHERE is_counterfeit_alert = true
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_medicines_counterfeit_alert
  ON public.medicines (is_counterfeit_alert)
  WHERE is_counterfeit_alert = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- Updated_at index (for ordering recent alerts)
-- Used by: ORDER BY created_at DESC
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_medicines_created_at
  ON public.medicines (created_at DESC);

-- =============================================================================
-- VERIFICATION QUERY (run manually after applying)
-- =============================================================================
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'medicines'
-- ORDER BY indexname;
-- =============================================================================
