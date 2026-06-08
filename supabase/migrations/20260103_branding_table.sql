-- RivalEye: Branding Extraction Feature Migration
-- Creates table for storing competitor branding/design system data

-- ══════════════════════════════════════════════════════════════════════════════
-- COMPETITOR BRANDING TABLE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS competitor_branding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    branding_data JSONB NOT NULL,
    extracted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient lookup by competitor
CREATE INDEX IF NOT EXISTS idx_competitor_branding_competitor 
    ON competitor_branding(competitor_id);

-- Index for ordering by extraction time
CREATE INDEX IF NOT EXISTS idx_competitor_branding_extracted 
    ON competitor_branding(extracted_at DESC);

-- ══════════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE competitor_branding IS 'Stores extracted branding/design system data for competitors (Pro feature)';
COMMENT ON COLUMN competitor_branding.branding_data IS 'JSON containing colors, typography, fonts, component styles, assets';
