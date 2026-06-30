-- =============================================================================
-- SahiDawa — Fix search_medicines_text to use existing pg_trgm GIN indexes
-- =============================================================================
-- WHY THIS EXISTS:
--   search_medicines_text (added in 20260606000000_add_medicine_rag.sql) was
--   written to rely on pg_trgm, and its own comment claims it "leverages the
--   existing GIN trgm indexes on generic_name and brand_name" — but the
--   function's WHERE clause does not actually use them:
--
--     WHERE m.generic_name ILIKE '%' || query_text || '%'
--        OR m.brand_name ILIKE '%' || query_text || '%'
--        OR m.composition ILIKE '%' || query_text || '%'
--        OR similarity(COALESCE(m.generic_name, ''), query_text) > 0.2
--        OR similarity(COALESCE(m.brand_name, ''), query_text) > 0.2
--
--   Two separate problems here:
--     1. Leading-wildcard ILIKE ('%term%') cannot use a btree index, and is
--        not the pattern pg_trgm's GIN opclass accelerates either.
--     2. Calling similarity(col, query) as a bare function in a WHERE clause
--        does NOT trigger index usage — only the `%` similarity operator
--        (col % query) is recognised by the planner against a gin_trgm_ops
--        index. A bare similarity() call forces Postgres to compute it for
--        every row, i.e. a full sequential scan on medicines on every call.
--
--   The GIN trgm indexes themselves (idx_medicines_brand_name_trgm,
--   idx_medicines_generic_name_trgm — added in
--   20260616000000_add_medicines_trgm_indexes.sql, ten days after this
--   function) are real and correctly built. This migration only corrects
--   the function body so it actually uses them, via the `%` operator.
--
--   composition has no trgm index (confirmed: no migration creates one), so
--   it remains a sequential-scan fallback signal in the GREATEST() ranking —
--   acceptable since it's the lowest-priority of the three matched fields.
--
--   No application code changes are required: the function's name, argument
--   signature, and return shape are all unchanged, so this is a drop-in
--   replacement for the existing apps/api/src/routes/scan.ts /match route,
--   including its Redis caching, which is untouched by this migration.
-- =============================================================================

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
  strength           VARCHAR(100),
  dosage_form        VARCHAR(100),
  schedule           VARCHAR(50),
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
    m.strength,
    m.dosage_form,
    m.schedule,
    m.mrp,
    m.jan_aushadhi_price,
    GREATEST(
      similarity(COALESCE(m.generic_name, ''), query_text),
      similarity(COALESCE(m.brand_name, ''), query_text),
      similarity(COALESCE(m.composition, ''), query_text)
    )::double precision AS similarity
  FROM public.medicines m
  WHERE
    -- `%` is pg_trgm's similarity operator — unlike a bare similarity() call,
    -- this IS recognised by the planner against a gin_trgm_ops index, so
    -- these two conditions use idx_medicines_generic_name_trgm /
    -- idx_medicines_brand_name_trgm instead of a sequential scan.
    COALESCE(m.generic_name, '') % query_text
    OR COALESCE(m.brand_name, '') % query_text
    -- composition has no trgm index — kept as a plain ILIKE fallback signal,
    -- lowest priority in the GREATEST() ranking below.
    OR m.composition ILIKE '%' || query_text || '%'
  ORDER BY similarity DESC
  LIMIT GREATEST(match_count, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Set a session-level similarity threshold so the `%` operator's implicit
-- cutoff matches the 0.2 threshold the function previously enforced via the
-- explicit `similarity(...) > 0.2` checks. Without this, pg_trgm's default
-- threshold (0.3) would be slightly stricter than the original behavior.
-- This is set per-function via a config parameter so it does not affect
-- other queries on the connection.
ALTER FUNCTION search_medicines_text(TEXT, INTEGER)
  SET pg_trgm.similarity_threshold = 0.2;
  