-- =============================================================================
-- SahiDawa — Per-Caller API Keys Table
-- =============================================================================
-- WHY THIS EXISTS:
--   Previously the /api/v1/alerts/ingest endpoint authenticated callers with a
--   single shared API_SECRET_KEY env var. That approach provides zero caller
--   identity tracking and makes key rotation impossible without co-ordinating
--   with every caller.
--
--   This migration replaces the shared static secret with per-caller API keys
--   stored in the database. Each key is identified by its SHA-256 hash so the
--   plaintext value is never persisted. Keys can be individually revoked
--   (is_active = false) without affecting other callers, and caller_name
--   provides an audit trail.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash        TEXT NOT NULL UNIQUE,
    caller_name     TEXT NOT NULL,
    scopes          TEXT[] NOT NULL DEFAULT '{}',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ,
    created_by      TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash   ON public.api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active     ON public.api_keys (is_active) WHERE is_active = TRUE;
