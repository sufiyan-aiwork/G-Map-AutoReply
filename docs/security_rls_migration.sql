-- ====================================================================
-- Techzone Academy - Phase 1 Security Remediation: Supabase RLS Hardening
-- Non-destructive, idempotent migration to restrict all backend tables
-- strictly to service_role and revoke anon/authenticated PostgREST access.
-- Safe to run on an existing live Supabase database (modifies permissions/policies only;
-- touches zero rows of customer review, template, config, or log data).
-- Run this script in your Supabase SQL Editor.
-- ====================================================================

-- 1. Revoke broad public/anon/authenticated privileges on schema objects & defaults
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated;

-- 2. Ensure service_role retains full backend access
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

-- 3. Explicitly revoke anon/authenticated grants per application table
REVOKE ALL ON TABLE reviews FROM anon, authenticated;
REVOKE ALL ON TABLE reply_templates FROM anon, authenticated;
REVOKE ALL ON TABLE published_replies FROM anon, authenticated;
REVOKE ALL ON TABLE business_config FROM anon, authenticated;
REVOKE ALL ON TABLE system_logs FROM anon, authenticated;
REVOKE ALL ON TABLE admin_users FROM anon, authenticated;

GRANT ALL ON TABLE reviews TO service_role;
GRANT ALL ON TABLE reply_templates TO service_role;
GRANT ALL ON TABLE published_replies TO service_role;
GRANT ALL ON TABLE business_config TO service_role;
GRANT ALL ON TABLE system_logs TO service_role;
GRANT ALL ON TABLE admin_users TO service_role;

-- 4. Enable Row Level Security across all application tables
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE published_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- 5. Replace unscoped policies with strict TO service_role policies (USING + WITH CHECK)
DROP POLICY IF EXISTS "Allow service role full access on reviews" ON reviews;
CREATE POLICY "Allow service role full access on reviews"
    ON reviews
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role full access on reply_templates" ON reply_templates;
CREATE POLICY "Allow service role full access on reply_templates"
    ON reply_templates
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role full access on published_replies" ON published_replies;
CREATE POLICY "Allow service role full access on published_replies"
    ON published_replies
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role full access on business_config" ON business_config;
CREATE POLICY "Allow service role full access on business_config"
    ON business_config
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role full access on system_logs" ON system_logs;
CREATE POLICY "Allow service role full access on system_logs"
    ON system_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role full access on admin_users" ON admin_users;
CREATE POLICY "Allow service role full access on admin_users"
    ON admin_users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 6. Read-only verification queries (inspect output in Supabase SQL Editor)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('reviews', 'reply_templates', 'published_replies', 'business_config', 'system_logs', 'admin_users')
ORDER BY tablename;

SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('reviews', 'reply_templates', 'published_replies', 'business_config', 'system_logs', 'admin_users')
ORDER BY tablename, policyname;

SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('reviews', 'reply_templates', 'published_replies', 'business_config', 'system_logs', 'admin_users')
  AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
ORDER BY table_name, grantee, privilege_type;
