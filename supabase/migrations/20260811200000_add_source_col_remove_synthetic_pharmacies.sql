-- =============================================================================
-- SahiDawa — Add source column & remove synthetic seed pharmacies
-- =============================================================================
-- Context:
--   The original seed.sql inserted 9 fake pharmacies (sequential UUIDs like
--   11111111-... through 99999999-...) with placeholder addresses in Delhi,
--   Mumbai, Bangalore, Nagpur and Guwahati. These are NOT real stores.
--
-- This migration:
--   1. Adds a 'source' column to pharmacies so we can track data provenance
--      (e.g. 'janaushadhi_scraper', 'osm', 'user_submitted', 'seed_dev')
--   2. Marks the known fake seed records with source='seed_dev' and
--      is_active=false so they are hidden from the map
--   3. Real store data is loaded by the ETL (apps/etl/run_stores.py)
--
-- NOTE: We soft-delete rather than hard-delete to preserve referential
-- integrity with any future audit tables.
-- =============================================================================

-- 1. Add source column for data provenance tracking
ALTER TABLE public.pharmacies
  ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'unknown';

-- Index for filtering by source in analytics
CREATE INDEX IF NOT EXISTS idx_pharmacies_source ON public.pharmacies(source);

-- 2. Tag and deactivate the known synthetic seed records
--    (These have sequential UUIDs from seed.sql — never real stores)
UPDATE public.pharmacies
SET
    source = 'seed_dev',
    is_active = false,
    status = 'pending'
WHERE id IN (
    '11111111-1111-1111-1111-111111111111',  -- Fake: Delhi
    '22222222-2222-2222-2222-222222222222',  -- Fake: Mumbai
    '33333333-3333-3333-3333-333333333333',  -- Fake: Bangalore
    '44444444-4444-4444-4444-444444444444',  -- Fake: Nagpur
    '55555555-5555-5555-5555-555555555555',  -- Seed: PMBJK00173 Guwahati
    '66666666-6666-6666-6666-666666666666',  -- Seed: PMBJK00174 Guwahati
    '77777777-7777-7777-7777-777777777777',  -- Seed: PMBJK00175 Kamrup
    '88888888-8888-8888-8888-888888888888',  -- Seed: PMBJK00176 Kamrup
    '99999999-9999-9999-9999-999999999999'   -- Seed: PMBJK00177 Guwahati
);

-- 3. Update the get_nearest_pharmacies RPC to also filter source != 'seed_dev'
--    so deactivated seed records never appear even if is_active is accidentally reset
-- (The is_active = true filter already handles this, but belt-and-suspenders)
-- No RPC change needed — is_active=false already excludes them.

-- 4. Tag existing real pharmacies with source if not set
UPDATE public.pharmacies
SET source = 'manual'
WHERE source = 'unknown'
  AND id NOT IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555',
    '66666666-6666-6666-6666-666666666666',
    '77777777-7777-7777-7777-777777777777',
    '88888888-8888-8888-8888-888888888888',
    '99999999-9999-9999-9999-999999999999'
  );
