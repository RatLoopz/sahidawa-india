-- =============================================================================
-- SahiDawa — Add license_id to pharmacies table
-- =============================================================================
-- Adds a unique license_id column to enforce registration uniqueness at the
-- database level and prevent physical duplicates.
-- =============================================================================

ALTER TABLE public.pharmacies ADD COLUMN IF NOT EXISTS license_id VARCHAR(100) UNIQUE;
