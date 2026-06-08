-- Align the database with the current application code paths.
-- Safe to run more than once.

-- Users: app supports enterprise plan and JSON settings.
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_plan_check,
    ADD CONSTRAINT users_plan_check CHECK (plan IN ('free', 'pro', 'enterprise'));

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{
        "email_enabled": true,
        "digest_frequency": "instant",
        "slack_webhook_url": null
    }'::jsonb;

CREATE INDEX IF NOT EXISTS idx_users_settings ON users USING gin(settings);

-- Competitors: scheduled jobs use is_active while user-facing routes use status.
ALTER TABLE competitors
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS best_scraper TEXT;

ALTER TABLE competitors
    DROP CONSTRAINT IF EXISTS competitors_best_scraper_check,
    ADD CONSTRAINT competitors_best_scraper_check
        CHECK (best_scraper IS NULL OR best_scraper IN ('firecrawl', 'playwright'));

CREATE INDEX IF NOT EXISTS idx_competitors_active ON competitors(is_active);

UPDATE competitors
SET is_active = (status = 'active')
WHERE is_active IS NULL;

-- Analyses: manual analysis stores screenshot paths in R2.
ALTER TABLE analyses
    ADD COLUMN IF NOT EXISTS screenshot_path TEXT;

-- Alerts: current dashboard/API/trigger code uses the richer alert shape below.
ALTER TABLE alerts
    ADD COLUMN IF NOT EXISTS diff_summary TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS ai_insight JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS type TEXT,
    ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'medium',
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS message TEXT,
    ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_dismissed BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;

ALTER TABLE alerts
    ALTER COLUMN diff_summary DROP NOT NULL,
    ALTER COLUMN ai_insight DROP NOT NULL,
    ALTER COLUMN diff_summary SET DEFAULT '',
    ALTER COLUMN ai_insight SET DEFAULT '{}'::jsonb;

ALTER TABLE alerts
    DROP CONSTRAINT IF EXISTS alerts_severity_check,
    ADD CONSTRAINT alerts_severity_check
        CHECK (severity IS NULL OR severity IN ('low', 'medium', 'high'));

UPDATE alerts a
SET user_id = c.user_id
FROM competitors c
WHERE a.competitor_id = c.id
  AND a.user_id IS NULL;

UPDATE alerts
SET
    title = COALESCE(title, diff_summary, message, 'Competitor change detected'),
    description = COALESCE(description, diff_summary, message, ''),
    type = COALESCE(type, 'change'),
    is_read = COALESCE(is_read, read, false);

CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user_read_created ON alerts(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_competitor_created ON alerts(competitor_id, created_at DESC);

-- Pricing snapshots: keep one canonical geo-aware table shape.
ALTER TABLE pricing_snapshots
    ADD COLUMN IF NOT EXISTS pricing_context_id UUID REFERENCES pricing_contexts(id),
    ADD COLUMN IF NOT EXISTS source TEXT,
    ADD COLUMN IF NOT EXISTS currency_detected TEXT,
    ADD COLUMN IF NOT EXISTS pricing_schema JSONB,
    ADD COLUMN IF NOT EXISTS dom_hash TEXT,
    ADD COLUMN IF NOT EXISTS screenshot_path TEXT,
    ADD COLUMN IF NOT EXISTS taken_at TIMESTAMPTZ DEFAULT now();

-- Legacy columns may exist from the older non-geo schema. Add them as nullable
-- compatibility columns before backfilling so this migration works from either
-- schema shape.
ALTER TABLE pricing_snapshots
    ADD COLUMN IF NOT EXISTS pricing_data JSONB,
    ADD COLUMN IF NOT EXISTS region TEXT,
    ADD COLUMN IF NOT EXISTS currency TEXT,
    ADD COLUMN IF NOT EXISTS hash TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE pricing_snapshots
    DROP CONSTRAINT IF EXISTS pricing_snapshots_source_check,
    ADD CONSTRAINT pricing_snapshots_source_check
        CHECK (source IS NULL OR source IN ('firecrawl', 'playwright', 'vision', 'cheerio'));

UPDATE pricing_snapshots
SET
    pricing_schema = COALESCE(pricing_schema, pricing_data),
    currency_detected = COALESCE(currency_detected, currency),
    dom_hash = COALESCE(dom_hash, hash),
    taken_at = COALESCE(taken_at, created_at),
    source = COALESCE(source, 'playwright')
WHERE pricing_schema IS NULL
   OR taken_at IS NULL
   OR currency_detected IS NULL
   OR dom_hash IS NULL
   OR source IS NULL;

UPDATE pricing_snapshots ps
SET pricing_context_id = pc.id
FROM pricing_contexts pc
WHERE ps.pricing_context_id IS NULL
  AND pc.key = COALESCE(ps.region, 'global');

UPDATE pricing_snapshots ps
SET pricing_context_id = pc.id
FROM pricing_contexts pc
WHERE ps.pricing_context_id IS NULL
  AND pc.key = 'global';

CREATE INDEX IF NOT EXISTS idx_pricing_snapshots_competitor_taken
    ON pricing_snapshots(competitor_id, taken_at DESC);

CREATE INDEX IF NOT EXISTS idx_pricing_snapshots_context_taken
    ON pricing_snapshots(pricing_context_id, taken_at DESC);

-- Helper functions used by quota code.
CREATE OR REPLACE FUNCTION increment_manual_check_count(user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE users
    SET manual_checks_today = manual_checks_today + 1
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;
