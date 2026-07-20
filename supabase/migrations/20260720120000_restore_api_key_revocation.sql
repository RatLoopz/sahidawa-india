-- =============================================================================
-- Restore API key revocation + usage tracking
-- =============================================================================
-- The 20260704153000 recreation of public.api_keys dropped two columns that an
-- earlier migration (20260609000000) relied on for key lifecycle management:
--
--   * is_active     -- lets a leaked key be revoked without deleting the row
--   * last_used_at  -- records when a key was last used (abuse visibility)
--
-- Without is_active a compromised key cannot be revoked, and apiKeyAuth.ts was
-- writing last_used_at into a column that no longer existed (a silent no-op).
-- This restores both columns idempotently so the middleware and the new
-- revoke/list endpoints work again.

ALTER TABLE public.api_keys
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.api_keys
    ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- Listing and pruning a user's live keys only ever touches active rows, so a
-- partial index keeps that lookup cheap without indexing revoked keys.
CREATE INDEX IF NOT EXISTS idx_api_keys_user_active
    ON public.api_keys (user_id)
    WHERE is_active;
