-- RivalEye: Tech Stack Detection Feature Migration
-- Creates table for storing competitor tech stack detection data

-- ══════════════════════════════════════════════════════════════════════════════
-- COMPETITOR TECH STACK TABLE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS competitor_techstack (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    technologies JSONB NOT NULL,  -- Array of detected technologies
    summary JSONB NOT NULL,       -- Framework, analytics, payments summary
    extracted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient lookup by competitor
CREATE INDEX IF NOT EXISTS idx_competitor_techstack_competitor 
    ON competitor_techstack(competitor_id);

-- Index for ordering by extraction time
CREATE INDEX IF NOT EXISTS idx_competitor_techstack_extracted 
    ON competitor_techstack(extracted_at DESC);

-- ══════════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE competitor_techstack IS 'Stores detected tech stack for competitors (Pro feature)';
COMMENT ON COLUMN competitor_techstack.technologies IS 'Array of {name, category, confidence, evidence}';
COMMENT ON COLUMN competitor_techstack.summary IS 'JSON with framework, analytics, payments, marketing, hosting';
