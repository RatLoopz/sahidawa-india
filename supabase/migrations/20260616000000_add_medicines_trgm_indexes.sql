-- =============================================================================
-- SahiDawa — Add pg_trgm Indexes for Medicines Table
-- =============================================================================
-- WHY THIS EXISTS:
--   The API uses `ilike '%word%'` for fuzzy substring matching on the medicines table.
--   Without a GIN trigram index, these queries cause full table scans.
--   This migration adds the necessary pg_trgm indexes to brand_name and generic_name
--   to ensure O(1) or O(log N) fast substring search across 245k+ records.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN index on brand_name using trigram operations
CREATE INDEX IF NOT EXISTS idx_medicines_brand_name_trgm 
  ON public.medicines 
  USING gin (brand_name gin_trgm_ops);

-- Create GIN index on generic_name using trigram operations
CREATE INDEX IF NOT EXISTS idx_medicines_generic_name_trgm 
  ON public.medicines 
  USING gin (generic_name gin_trgm_ops);
