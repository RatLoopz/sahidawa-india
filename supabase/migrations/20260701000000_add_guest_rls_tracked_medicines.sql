-- =============================================================================
-- SahiDawa — Add Guest RLS to tracked_medicines
-- =============================================================================
-- WHY THIS EXISTS:
--   Guest users (anon role) need to be able to view and insert tracked medicines
--   using their session_id. The previous RLS policy only allowed authenticated
--   users and service_role.
-- =============================================================================

CREATE POLICY "tracked_medicines_guest_access"
  ON public.tracked_medicines
  FOR ALL
  TO anon
  USING (
    session_id = current_setting('request.jwt.claims', true)::json->>'session_id'
    AND user_id IS NULL
  )
  WITH CHECK (
    session_id = current_setting('request.jwt.claims', true)::json->>'session_id'
    AND user_id IS NULL
  );
