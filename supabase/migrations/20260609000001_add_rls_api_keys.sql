-- =============================================================================
-- SahiDawa — RLS Policies for api_keys Table
-- =============================================================================
-- WHY THIS EXISTS:
--   The api_keys table stores per-caller API key hashes. Only the backend
--   Express API (which uses the service_role key) should be able to read or
--   write these records. Callers authenticate via their API key header, not
--   via Supabase auth, so anon/authenticated roles should have no access.
-- =============================================================================

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_service_only"
  ON public.api_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
