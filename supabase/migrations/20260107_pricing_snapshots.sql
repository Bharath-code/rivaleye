-- ══════════════════════════════════════════════════════════════════════════════
-- PRICING SNAPSHOTS TABLE
-- Stores historical pricing data for trend analysis and market radar
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pricing_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    
    -- Pricing data
    pricing_data JSONB NOT NULL,           -- Full pricing schema
    region TEXT DEFAULT 'global',           -- Region this snapshot is from
    currency TEXT DEFAULT 'USD',            -- Currency code
    
    -- Metadata
    hash TEXT,                              -- Hash for detecting changes
    source TEXT DEFAULT 'vision',           -- 'vision', 'cheerio', 'firecrawl'
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_pricing_snapshots_competitor_id ON pricing_snapshots(competitor_id);
CREATE INDEX IF NOT EXISTS idx_pricing_snapshots_region ON pricing_snapshots(region);
CREATE INDEX IF NOT EXISTS idx_pricing_snapshots_created_at ON pricing_snapshots(created_at);

-- RLS Policy
ALTER TABLE pricing_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pricing snapshots" ON pricing_snapshots
    FOR SELECT USING (
        competitor_id IN (
            SELECT id FROM competitors WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role has full access to pricing_snapshots" ON pricing_snapshots
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
