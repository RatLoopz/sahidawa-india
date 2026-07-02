-- =============================================================================
-- SahiDawa — pgvector RAG support for medicine monographs
-- =============================================================================
-- Adds an embedding column + ivfflat index to the medicines table and two
-- SECURITY DEFINER retrieval functions used by the voice triage RAG pipeline:
--
--   1. match_medicines        — semantic search over monograph embeddings
--                               (primary retrieval path).
--   2. search_medicines_text  — pg_trgm fuzzy fallback over generic/brand
--                               name + composition, used whenever embeddings
--                               are unavailable or the query cannot be embedded.
--
-- Both functions are SECURITY DEFINER so they can be called via the anon key,
-- matching the pattern established by get_nearest_pharmacies and
-- find_lasa_conflicts.
--
-- NOTE: embeddings are populated out-of-band (ETL / backfill). Rows without an
-- embedding are simply skipped by match_medicines, so the trgm fallback keeps
-- retrieval working before any embeddings exist.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 768-dimensional vectors match Google's text-embedding-004 output.
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS embedding vector(768);

-- ivfflat index for cosine-distance nearest-neighbour search.
CREATE INDEX IF NOT EXISTS idx_medicines_embedding
  ON medicines USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. match_medicines
--    Returns medicines whose monograph embedding is most similar to the query
--    embedding, ranked by cosine similarity and filtered by a threshold.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION match_medicines(
  query_embedding vector(768),
  match_count INTEGER DEFAULT 5,
  similarity_threshold DOUBLE PRECISION DEFAULT 0.2
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
    (1 - (m.embedding <=> query_embedding))::double precision AS similarity
  FROM public.medicines m
  WHERE m.embedding IS NOT NULL
    AND (1 - (m.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY m.embedding <=> query_embedding ASC
  LIMIT GREATEST(match_count, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. search_medicines_text
--    pg_trgm fuzzy fallback. Leverages the existing GIN trgm indexes on
--    generic_name and brand_name. Returns the best trigram similarity across
--    generic name, brand name, and composition.
-- ─────────────────────────────────────────────────────────────────────────────
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
  WHERE m.generic_name ILIKE '%' || query_text || '%'
     OR m.brand_name ILIKE '%' || query_text || '%'
     OR m.composition ILIKE '%' || query_text || '%'
     OR similarity(COALESCE(m.generic_name, ''), query_text) > 0.2
     OR similarity(COALESCE(m.brand_name, ''), query_text) > 0.2
  ORDER BY similarity DESC
  LIMIT GREATEST(match_count, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
