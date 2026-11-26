-- ====================================================================
-- Techzone Academy - Phase 2 Optional Migration: Persistent Session Revocation & OAuth Nonces
-- Creates service_role-only tables for multi-worker / restart-safe JWT revocation
-- and single-use OAuth CSRF state consumption.
-- Non-destructive; touches zero existing tables or customer data.
-- Run this script in your Supabase SQL Editor when ready to enable DB-backed revocation.
-- ====================================================================

CREATE TABLE IF NOT EXISTS admin_revoked_tokens (
    jti VARCHAR(128) PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_revoked_tokens_expires_at ON admin_revoked_tokens(expires_at);

CREATE TABLE IF NOT EXISTS oauth_states (
    nonce VARCHAR(128) PRIMARY KEY,
    admin_id VARCHAR(128),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON oauth_states(expires_at);

REVOKE ALL ON TABLE admin_revoked_tokens FROM anon, authenticated;
REVOKE ALL ON TABLE oauth_states FROM anon, authenticated;

GRANT ALL ON TABLE admin_revoked_tokens TO service_role;
GRANT ALL ON TABLE oauth_states TO service_role;

ALTER TABLE admin_revoked_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access on admin_revoked_tokens" ON admin_revoked_tokens;
CREATE POLICY "Allow service role full access on admin_revoked_tokens"
    ON admin_revoked_tokens
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role full access on oauth_states" ON oauth_states;
CREATE POLICY "Allow service role full access on oauth_states"
    ON oauth_states
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
