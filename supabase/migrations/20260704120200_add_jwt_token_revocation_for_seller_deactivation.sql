-- Migration: JWT Token Revocation for Seller Deactivation
-- Date: 2026-07-04
-- Description: Implement token revocation mechanism for seller account deactivation

-- ============================================================================
-- TOKEN REVOCATIONS TABLE (Track invalidated JWT tokens)
-- ============================================================================
CREATE TABLE IF NOT EXISTS token_revocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_jti varchar(500) UNIQUE, -- JWT ID (jti) claim for specific token revocation
    revoked_at timestamp with time zone DEFAULT now(),
    reason varchar(255), -- e.g., 'account_deactivation', 'logout', 'password_change'
    expires_at timestamp with time zone -- Token expiry time (when to clean up entry)
);

CREATE INDEX IF NOT EXISTS idx_token_revocations_user_id ON token_revocations(user_id);
CREATE INDEX IF NOT EXISTS idx_token_revocations_token_jti ON token_revocations(token_jti);
CREATE INDEX IF NOT EXISTS idx_token_revocations_expires_at ON token_revocations(expires_at);

-- ============================================================================
-- ADD is_active COLUMN TO SELLERS TABLE
-- ============================================================================
-- Check if column already exists to avoid errors on re-run
ALTER TABLE sellers
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT TRUE;

-- Create index for deactivated sellers queries
CREATE INDEX IF NOT EXISTS idx_sellers_is_active ON sellers(is_active);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE token_revocations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES - TOKEN_REVOCATIONS TABLE
-- ============================================================================
-- Users can only read their own revocations (for debugging)
DROP POLICY IF EXISTS "Users read own revocations" ON token_revocations;
CREATE POLICY "Users read own revocations" ON token_revocations
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Admin can manage all revocations
DROP POLICY IF EXISTS "Admin access to revocations" ON token_revocations;
CREATE POLICY "Admin access to revocations" ON token_revocations
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ============================================================================
-- FUNCTION: Revoke all tokens for a user (called on deactivation)
-- ============================================================================
CREATE OR REPLACE FUNCTION revoke_user_tokens(target_user_id uuid, revocation_reason varchar)
RETURNS void AS $$
BEGIN
    INSERT INTO token_revocations (user_id, reason, expires_at)
    VALUES (target_user_id, revocation_reason, now() + interval '30 days')
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: Auto-revoke tokens when seller is deactivated
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_seller_deactivation_revoke_tokens()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.is_active = TRUE AND NEW.is_active = FALSE) THEN
        PERFORM revoke_user_tokens(NEW.id, 'account_deactivation');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS seller_deactivation_revoke_tokens ON sellers;
CREATE TRIGGER seller_deactivation_revoke_tokens
AFTER UPDATE ON sellers
FOR EACH ROW
EXECUTE FUNCTION trigger_seller_deactivation_revoke_tokens();

-- ============================================================================
-- CLEANUP CRON JOB (to be called periodically, remove expired revocations)
-- Note: In production, set up pg_cron to call this regularly
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_revocations()
RETURNS TABLE(deleted_count bigint) AS $$
DECLARE
    count bigint;
BEGIN
    DELETE FROM token_revocations
    WHERE expires_at IS NOT NULL AND expires_at < now();
    GET DIAGNOSTICS count = ROW_COUNT;
    RETURN QUERY SELECT count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
