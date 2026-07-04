-- Add per-key salt to api_keys to prevent precomputation attacks
-- from the previous hardcoded static salt. Existing keys will need
-- to be regenerated since their raw secret was never stored.

ALTER TABLE public.api_keys
    ADD COLUMN IF NOT EXISTS key_salt TEXT;

COMMENT ON COLUMN public.api_keys.key_salt IS
    'Unique per-row cryptographic salt (hex-encoded, 32 random bytes) used to hash the raw API key secret via PBKDF2. Replaces the previous hardcoded static salt.';