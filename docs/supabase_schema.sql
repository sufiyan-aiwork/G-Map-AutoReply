-- ====================================================================
-- Techzone Academy - Customer Review Reply Automation System
-- Supabase PostgreSQL Database Schema
-- ====================================================================

-- 1. Enable pgcrypto / uuid extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- TABLE 1: reviews
-- Stores customer reviews collected from Google Business Profile
-- ====================================================================
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_review_id VARCHAR(255) NOT NULL,
    location_id VARCHAR(255) NOT NULL,
    star_rating INTEGER NOT NULL CHECK (star_rating >= 1 AND star_rating <= 5),
    review_text TEXT,
    reviewer_name VARCHAR(255),
    review_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processing_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processed', 'failed', 'ignored')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_location_google_review UNIQUE (location_id, google_review_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(star_rating);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(processing_status);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);

-- ====================================================================
-- TABLE 2: reply_templates
-- Predefined reply templates (Strictly two: Positive & Negative)
-- ====================================================================
CREATE TABLE IF NOT EXISTS reply_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(50) NOT NULL UNIQUE CHECK (category IN ('positive', 'negative')),
    reply_text TEXT NOT NULL,
    applicable_ratings INTEGER[] NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial templates with strict classification rules
INSERT INTO reply_templates (category, reply_text, applicable_ratings, is_active)
VALUES 
    (
        'positive',
        'Thank you for sharing your valuable feedback with Techzone Academy! We are happy to have you as part of our learning community. We truly appreciate your support!',
        ARRAY[3, 4, 5],
        TRUE
    ),
    (
        'negative',
        'We sincerely apologise that your experience did not meet your expectations. Thank you for sharing your feedback with us. We value your suggestions and will continue working to improve our services.',
        ARRAY[1, 2],
        TRUE
    )
ON CONFLICT (category) DO UPDATE 
SET 
    applicable_ratings = EXCLUDED.applicable_ratings,
    updated_at = NOW();

-- ====================================================================
-- TABLE 3: published_replies
-- Tracks replies sent and published back to Google Business Profile
-- ====================================================================
CREATE TABLE IF NOT EXISTS published_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    reply_text TEXT NOT NULL,
    publishing_status VARCHAR(50) NOT NULL DEFAULT 'published' CHECK (publishing_status IN ('pending', 'published', 'failed')),
    google_published_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_published_replies_review ON published_replies(review_id);
CREATE INDEX IF NOT EXISTS idx_published_replies_status ON published_replies(publishing_status);

-- ====================================================================
-- TABLE 4: business_config
-- System and Google Profile configuration settings
-- ====================================================================
CREATE TABLE IF NOT EXISTS business_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name VARCHAR(255) NOT NULL DEFAULT 'Techzone Academy',
    google_account_id VARCHAR(255),
    google_location_id VARCHAR(255),
    auto_reply_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    polling_interval INTEGER NOT NULL DEFAULT 15, -- in minutes
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed single default business config record
INSERT INTO business_config (business_name, auto_reply_enabled, polling_interval)
SELECT 'Techzone Academy', TRUE, 15
WHERE NOT EXISTS (SELECT 1 FROM business_config);

-- ====================================================================
-- TABLE 5: system_logs
-- Comprehensive audit trail for system operations and publishing
-- ====================================================================
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'info' CHECK (status IN ('info', 'success', 'warning', 'error')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_status ON system_logs(status);

-- ====================================================================
-- TRIGGER: Auto-update updated_at timestamps
-- ====================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reviews_updated_at ON reviews;
CREATE TRIGGER trg_reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_reply_templates_updated_at ON reply_templates;
CREATE TRIGGER trg_reply_templates_updated_at
    BEFORE UPDATE ON reply_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_business_config_updated_at ON business_config;
CREATE TRIGGER trg_business_config_updated_at
    BEFORE UPDATE ON business_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES & PERMISSIONS
-- Grant full table permissions to API roles (service_role, anon, authenticated)
-- ====================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE published_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Allow access policies
CREATE POLICY "Allow service role full access on reviews" ON reviews FOR ALL USING (true);
CREATE POLICY "Allow service role full access on reply_templates" ON reply_templates FOR ALL USING (true);
CREATE POLICY "Allow service role full access on published_replies" ON published_replies FOR ALL USING (true);
CREATE POLICY "Allow service role full access on business_config" ON business_config FOR ALL USING (true);
CREATE POLICY "Allow service role full access on system_logs" ON system_logs FOR ALL USING (true);

-- ====================================================================
-- TABLE 6: admin_users
-- Administrator accounts for dashboard and API access control
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

-- Restrict admin_users access strictly to service_role (never allow anon access to hashes)
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
