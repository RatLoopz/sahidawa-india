-- =============================================================================
-- Add expires_at to api_keys
-- =============================================================================

ALTER TABLE public.api_keys
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add an index to efficiently query non-expired keys (or prune expired ones)
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON public.api_keys (expires_at);
