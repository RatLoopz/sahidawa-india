-- =============================================================================
-- SahiDawa — Fix Medicines Unique Constraint
-- =============================================================================
-- WHY THIS EXISTS:
--   The previous unique constraint `idx_medicines_unique_variant` prevented storing
--   multiple variants or test entries (such as recalled/fake versions with different barcodes)
--   for the same branded drug, causing seed and ETL inserts to fail.
--
--   This migration drops the old constraint and recreates it to include `barcode_id`
--   in the unique key, allowing multiple variants/batches with distinct barcodes
--   while still ensuring generic drugs (where barcode_id is NULL) remain unique.
-- =============================================================================

ALTER TABLE public.medicines DROP CONSTRAINT IF EXISTS idx_medicines_unique_variant;

ALTER TABLE public.medicines ADD CONSTRAINT idx_medicines_unique_variant UNIQUE NULLS NOT DISTINCT (generic_name, brand_name, strength, dosage_form, source, barcode_id);
