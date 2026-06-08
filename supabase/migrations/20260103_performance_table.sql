-- RivalEye: Performance Insights Feature Migration
-- Creates table for storing competitor performance/Core Web Vitals data

-- ══════════════════════════════════════════════════════════════════════════════
-- COMPETITOR PERFORMANCE TABLE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS competitor_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    insights JSONB NOT NULL,      -- Full performance insights object
    extracted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient lookup by competitor
CREATE INDEX IF NOT EXISTS idx_competitor_performance_competitor 
    ON competitor_performance(competitor_id);

-- Index for ordering by extraction time
CREATE INDEX IF NOT EXISTS idx_competitor_performance_extracted 
    ON competitor_performance(extracted_at DESC);

-- ══════════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE competitor_performance IS 'Stores Core Web Vitals and performance metrics for competitors (Pro feature)';
COMMENT ON COLUMN competitor_performance.insights IS 'JSON containing coreWebVitals, metrics, resources, score';
