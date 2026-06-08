-- ══════════════════════════════════════════════════════════════════════════════
-- RIVALEYE DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════════
-- USERS TABLE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    
    -- Plan & Subscription
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    dodo_customer_id TEXT,
    dodo_subscription_id TEXT,
    subscription_status TEXT DEFAULT 'none' CHECK (subscription_status IN ('none', 'active', 'cancelled', 'past_due')),
    
    -- Quota Tracking
    crawls_today INTEGER DEFAULT 0,
    manual_checks_today INTEGER DEFAULT 0,
    last_quota_reset TIMESTAMPTZ DEFAULT now(),
    settings JSONB DEFAULT '{
        "email_enabled": true,
        "digest_frequency": "instant",
        "slack_webhook_url": null
    }'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for auth lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ══════════════════════════════════════════════════════════════════════════════
-- COMPETITORS TABLE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error')),
    is_active BOOLEAN DEFAULT true,
    best_scraper TEXT CHECK (best_scraper IS NULL OR best_scraper IN ('firecrawl', 'playwright')),
    
    -- Tracking
    last_checked_at TIMESTAMPTZ,
    failure_count INTEGER DEFAULT 0,
    last_failure_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_competitors_user_id ON competitors(user_id);
CREATE INDEX IF NOT EXISTS idx_competitors_status ON competitors(status);
CREATE INDEX IF NOT EXISTS idx_competitors_active ON competitors(is_active);

-- ══════════════════════════════════════════════════════════════════════════════
-- SNAPSHOTS TABLE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    
    hash TEXT NOT NULL,
    normalized_text TEXT NOT NULL,
    markdown TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for competitor lookups and hash deduplication
CREATE INDEX IF NOT EXISTS idx_snapshots_competitor_id ON snapshots(competitor_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_hash ON snapshots(competitor_id, hash);
CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON snapshots(created_at);

-- ══════════════════════════════════════════════════════════════════════════════
-- ALERTS TABLE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    
    diff_summary TEXT DEFAULT '',
    ai_insight JSONB DEFAULT '{}'::jsonb,
    is_meaningful BOOLEAN DEFAULT true,
    type TEXT,
    severity TEXT DEFAULT 'medium' CHECK (severity IS NULL OR severity IN ('low', 'medium', 'high')),
    title TEXT,
    description TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    is_dismissed BOOLEAN DEFAULT false,
    read BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for competitor lookups
CREATE INDEX IF NOT EXISTS idx_alerts_competitor_id ON alerts(competitor_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user_read_created ON alerts(user_id, is_read, created_at DESC);

-- ══════════════════════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- Function to increment crawl count atomically
CREATE OR REPLACE FUNCTION increment_crawl_count(user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE users
    SET crawls_today = crawls_today + 1
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment manual check count atomically
CREATE OR REPLACE FUNCTION increment_manual_check_count(user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE users
    SET manual_checks_today = manual_checks_today + 1
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to reset daily quotas (can be called by cron)
CREATE OR REPLACE FUNCTION reset_daily_quotas()
RETURNS void AS $$
BEGIN
    UPDATE users
    SET 
        crawls_today = 0,
        manual_checks_today = 0,
        last_quota_reset = now()
    WHERE last_quota_reset < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ══════════════════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own data" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Competitors: users can only access their own
CREATE POLICY "Users can view own competitors" ON competitors
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own competitors" ON competitors
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own competitors" ON competitors
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own competitors" ON competitors
    FOR DELETE USING (auth.uid() = user_id);

-- Snapshots: users can view snapshots of their competitors
CREATE POLICY "Users can view own snapshots" ON snapshots
    FOR SELECT USING (
        competitor_id IN (
            SELECT id FROM competitors WHERE user_id = auth.uid()
        )
    );

-- Alerts: users can view alerts for their competitors
CREATE POLICY "Users can view own alerts" ON alerts
    FOR SELECT USING (
        competitor_id IN (
            SELECT id FROM competitors WHERE user_id = auth.uid()
        )
    );

-- ══════════════════════════════════════════════════════════════════════════════
-- SERVICE ROLE BYPASS (for cron jobs and webhooks)
-- ══════════════════════════════════════════════════════════════════════════════

-- Allow service role to bypass RLS for server-side operations
CREATE POLICY "Service role has full access to users" ON users
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to competitors" ON competitors
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to snapshots" ON snapshots
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to alerts" ON alerts
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
