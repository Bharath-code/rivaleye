-- Analyses Table for Vision-Based Competitor Analysis
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    analysis_data JSONB NOT NULL,
    analysis_hash VARCHAR(64) NOT NULL,  -- SHA256 hash of key fields for change detection
    raw_analysis TEXT,
    screenshot_size INTEGER,
    model VARCHAR(100),
    has_changes BOOLEAN DEFAULT FALSE,  -- True if this analysis differs from previous
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_analyses_competitor ON analyses(competitor_id);
CREATE INDEX IF NOT EXISTS idx_analyses_user ON analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_created ON analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_hash ON analyses(analysis_hash);

-- RLS Policies
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

-- Users can read their own analyses
CREATE POLICY "Users can read own analyses"
    ON analyses FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own analyses
CREATE POLICY "Users can insert own analyses"
    ON analyses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "Service role full access to analyses"
    ON analyses FOR ALL
    USING (auth.role() = 'service_role');

