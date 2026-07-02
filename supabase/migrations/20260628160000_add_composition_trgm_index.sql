-- =============================================================================
-- SahiDawa — Add GIN trigram index on medicines.composition & update RPC
-- =============================================================================
-- WHY THIS EXISTS (Issue #2721):
--   The search_medicines_text RPC (last updated in
--   20260627010000_fix_search_medicines_text_trgm_usage.sql) already uses the
--   pg_trgm `%` similarity operator for brand_name and generic_name, backed by
--   GIN trigram indexes added in 20260616000000_add_medicines_trgm_indexes.sql.
--
--   However, the composition field was left as an ILIKE '%query%' fallback
--   because no trigram index existed for it. Leading-wildcard ILIKE forces a
--   full sequential scan on every call.
--
--   This migration:
--     1. Adds the missing GIN trigram index on medicines.composition.
--     2. Updates search_medicines_text to use the `%` similarity operator for
--        composition, matching the pattern already used for brand_name and
--        generic_name — so all three fields benefit from index-accelerated
--        similarity matching.
--
--   No application code changes are required: the function's name, argument
--   signature, and return shape are all unchanged.
-- =============================================================================

-- 1. Ensure pg_trgm extension exists (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Add GIN trigram index on composition (matches naming convention from
--    20260616000000_add_medicines_trgm_indexes.sql)
CREATE INDEX IF NOT EXISTS idx_medicines_composition_trgm
  ON public.medicines
  USING gin (composition gin_trgm_ops);

-- 3. Update search_medicines_text — only change: composition now uses `%`
--    instead of ILIKE. Everything else (ranking, ordering, limits, return
--    columns, brand/generic matching) is preserved exactly.
CREATE OR REPLACE FUNCTION search_medicines_text(
  query_text TEXT,
  match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
  id                 UUID,
  brand_name         VARCHAR(255),
  generic_name       VARCHAR(500),
  manufacturer       VARCHAR(255),
  composition        TEXT,
  mrp                NUMERIC(10, 2),
  jan_aushadhi_price NUMERIC(10, 2),
  similarity         DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.brand_name,
    m.generic_name,
    m.manufacturer,
    m.composition,
    m.mrp,
    m.jan_aushadhi_price,
    GREATEST(
      similarity(COALESCE(m.generic_name, ''), query_text),
      similarity(COALESCE(m.brand_name, ''), query_text),
      similarity(COALESCE(m.composition, ''), query_text)
    )::double precision AS similarity
  FROM public.medicines m
  WHERE
    -- All three conditions now use the `%` similarity operator, which is
    -- recognised by the planner against gin_trgm_ops indexes:
    --   idx_medicines_generic_name_trgm  (from 20260616000000)
    --   idx_medicines_brand_name_trgm    (from 20260616000000)
    --   idx_medicines_composition_trgm   (this migration)
    COALESCE(m.generic_name, '') % query_text
    OR COALESCE(m.brand_name, '') % query_text
    OR COALESCE(m.composition, '') % query_text
  ORDER BY similarity DESC
  LIMIT GREATEST(match_count, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Preserve the session-level similarity threshold from the previous migration
-- so the `%` operator's implicit cutoff remains 0.2 (matching original behavior).
ALTER FUNCTION search_medicines_text(TEXT, INTEGER)
  SET pg_trgm.similarity_threshold = 0.2;
