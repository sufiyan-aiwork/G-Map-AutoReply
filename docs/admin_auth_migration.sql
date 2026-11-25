-- ====================================================================
-- Techzone Academy - Admin Authentication Migration
-- Creates the admin_users table with indexes, triggers, and strict RLS
-- Run this script in your Supabase SQL Editor
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure updated_at trigger function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- TABLE 6: admin_users
-- Stores administrator accounts with scrypt password hashes only
-- ====================================================================
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(150) NOT NULL DEFAULT 'Administrator',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);

DROP TRIGGER IF EXISTS trg_admin_users_updated_at ON admin_users;
CREATE TRIGGER trg_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Strictly restrict admin_users to backend service_role only (protect password hashes)
REVOKE ALL ON TABLE admin_users FROM anon, authenticated;
GRANT ALL ON TABLE admin_users TO service_role;

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access on admin_users" ON admin_users;
CREATE POLICY "Allow service role full access on admin_users"
    ON admin_users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
