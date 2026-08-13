-- =============================================================================
-- SahiDawa — Fix seeded Jan Aushadhi Kendra pharmacy status
-- =============================================================================
-- The original seed.sql inserted pharmacies without the 'status' column, so
-- they defaulted to 'pending'. The get_nearest_pharmacies RPC filters by
-- status = 'approved', causing seeded stores to never appear on the map.
-- This migration approves all the known seed pharmacies by their fixed UUIDs.
-- =============================================================================

UPDATE public.pharmacies
SET
    status = 'approved',
    is_active = true,
    is_verified = true
WHERE id IN (
    '11111111-1111-1111-1111-111111111111',  -- Jan Aushadhi Kendra - Delhi
    '22222222-2222-2222-2222-222222222222',  -- Jan Aushadhi Kendra - Mumbai
    '33333333-3333-3333-3333-333333333333',  -- Jan Aushadhi Kendra - Bangalore
    '44444444-4444-4444-4444-444444444444',  -- Jan Aushadhi Kendra - Nagpur
    '55555555-5555-5555-5555-555555555555',  -- PMBJK00173 - Azara, Guwahati
    '66666666-6666-6666-6666-666666666666',  -- PMBJK00174 - Gorchuk, Guwahati
    '77777777-7777-7777-7777-777777777777',  -- PMBJK00175 - Mirza, Kamrup
    '88888888-8888-8888-8888-888888888888',  -- PMBJK00176 - Chhaygaon, Kamrup
    '99999999-9999-9999-9999-999999999999'   -- PMBJK00177 - Amingaon, Guwahati
);
