-- ══════════════════════════════════════════════════════════════════════════════
-- AEO (ANSWER ENGINE OPTIMIZATION) MONITOR
-- Run in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Per-competitor AEO settings
--    Stored on the competitor row (one-to-one) for fast access.
ALTER TABLE competitors
    ADD COLUMN IF NOT EXISTS aeo_queries TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS aeo_industry TEXT,
    ADD COLUMN IF NOT EXISTS aeo_enabled BOOLEAN DEFAULT true;

-- 2. AEO visibility scan results
--    One row per (competitor, query, model, scan).
--    High cardinality but bounded: ~50-250 rows/competitor/day.
CREATE TABLE IF NOT EXISTS aeo_visibility (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,

    -- The query we asked (e.g. "best CRM for SaaS startups")
    query TEXT NOT NULL,

    -- Which model answered (chatgpt | perplexity | claude | gemini | google_ai)
    model TEXT NOT NULL CHECK (model IN (
        'chatgpt', 'perplexity', 'claude', 'gemini', 'google_ai'
    )),

    -- Whether the brand was mentioned in the response
    mentioned BOOLEAN NOT NULL,

    -- Position in the response (1 = first mention, null = not mentioned)
    -- For lists, this is the index in the list. For prose, the order of appearance.
    position INTEGER,

    -- The actual response text (truncated to 2KB for storage efficiency)
    response_excerpt TEXT,

    -- Citation URLs the model included (JSON array)
    -- e.g. ["https://stripe.com/pricing", "https://en.wikipedia.org/wiki/Stripe"]
    citations JSONB DEFAULT '[]'::jsonb,

    -- Cost of this individual query (for billing transparency)
    cost_usd NUMERIC(10, 6) DEFAULT 0,

    -- When the scan ran
    scanned_at TIMESTAMPTZ DEFAULT now(),

    -- Latency of the LLM call (ms)
    latency_ms INTEGER
);

-- 3. Indexes for the common queries
--    "Show me this competitor's history" → (competitor_id, scanned_at DESC)
CREATE INDEX IF NOT EXISTS idx_aeo_competitor_time
    ON aeo_visibility(competitor_id, scanned_at DESC);

--    "Show me all queries for this model today" → (model, scanned_at DESC)
CREATE INDEX IF NOT EXISTS idx_aeo_model_time
    ON aeo_visibility(model, scanned_at DESC);

--    "Aggregate visibility score" → (user_id, competitor_id, scanned_at DESC)
CREATE INDEX IF NOT EXISTS idx_aeo_user_competitor_time
    ON aeo_visibility(user_id, competitor_id, scanned_at DESC);

--    "Filter by mentioned=true" → partial index for fast aggregation
CREATE INDEX IF NOT EXISTS idx_aeo_mentioned
    ON aeo_visibility(competitor_id, scanned_at DESC)
    WHERE mentioned = true;

-- 4. Composite view: latest snapshot per (competitor, query, model)
--    This makes dashboard queries O(1) instead of scanning history.
CREATE OR REPLACE VIEW aeo_visibility_latest AS
SELECT DISTINCT ON (competitor_id, query, model)
    id,
    user_id,
    competitor_id,
    query,
    model,
    mentioned,
    position,
    response_excerpt,
    citations,
    cost_usd,
    scanned_at,
    latency_ms
FROM aeo_visibility
ORDER BY competitor_id, query, model, scanned_at DESC;

-- 5. RLS
ALTER TABLE aeo_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own AEO data"
    ON aeo_visibility FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can write AEO data"
    ON aeo_visibility FOR INSERT
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can update AEO data"
    ON aeo_visibility FOR UPDATE
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can delete AEO data"
    ON aeo_visibility FOR DELETE
    USING (auth.jwt() ->> 'role' = 'service_role');

-- 6. Index for time-series aggregations (used by the dashboard chart)
CREATE INDEX IF NOT EXISTS idx_aeo_scanned_at
    ON aeo_visibility(scanned_at DESC);

-- 7. RPC: aggregate visibility score for a competitor over a window
--    Returns: total_queries, mentions, visibility_pct, avg_position
--    Visibility % = (mentions / total) * 100
CREATE OR REPLACE FUNCTION get_competitor_visibility(
    p_competitor_id UUID,
    p_since TIMESTAMPTZ DEFAULT now() - INTERVAL '7 days'
)
RETURNS TABLE (
    total_queries BIGINT,
    mentions BIGINT,
    visibility_pct NUMERIC,
    avg_position NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_queries,
        COUNT(*) FILTER (WHERE mentioned)::BIGINT AS mentions,
        ROUND(
            (COUNT(*) FILTER (WHERE mentioned)::NUMERIC /
             NULLIF(COUNT(*), 0)::NUMERIC) * 100,
            1
        ) AS visibility_pct,
        ROUND(
            AVG(position) FILTER (WHERE mentioned)::NUMERIC,
            1
        ) AS avg_position
    FROM aeo_visibility
    WHERE competitor_id = p_competitor_id
      AND scanned_at >= p_since;
END;
$$;

-- 8. RPC: per-model breakdown for a competitor
CREATE OR REPLACE FUNCTION get_competitor_visibility_by_model(
    p_competitor_id UUID,
    p_since TIMESTAMPTZ DEFAULT now() - INTERVAL '7 days'
)
RETURNS TABLE (
    model TEXT,
    total_queries BIGINT,
    mentions BIGINT,
    visibility_pct NUMERIC,
    avg_position NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        aeo_visibility.model,
        COUNT(*)::BIGINT AS total_queries,
        COUNT(*) FILTER (WHERE aeo_visibility.mentioned)::BIGINT AS mentions,
        ROUND(
            (COUNT(*) FILTER (WHERE aeo_visibility.mentioned)::NUMERIC /
             NULLIF(COUNT(*), 0)::NUMERIC) * 100,
            1
        ) AS visibility_pct,
        ROUND(
            AVG(position) FILTER (WHERE aeo_visibility.mentioned)::NUMERIC,
            1
        ) AS avg_position
    FROM aeo_visibility
    WHERE competitor_id = p_competitor_id
      AND scanned_at >= p_since
    GROUP BY aeo_visibility.model
    ORDER BY aeo_visibility.model;
END;
$$;

-- 9. RPC: detect AEO score changes (for the alert system)
--    Returns competitors whose 7-day visibility changed by ≥10% vs previous 7-day
CREATE OR REPLACE FUNCTION detect_aeo_changes(
    p_user_id UUID,
    p_min_change_pct NUMERIC DEFAULT 10
)
RETURNS TABLE (
    competitor_id UUID,
    competitor_name TEXT,
    current_pct NUMERIC,
    previous_pct NUMERIC,
    change_pct NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH current AS (
        SELECT
            c.id,
            c.name,
            ROUND(
                (COUNT(*) FILTER (WHERE av.mentioned)::NUMERIC /
                 NULLIF(COUNT(*), 0)::NUMERIC) * 100,
                1
            ) AS pct
        FROM competitors c
        LEFT JOIN aeo_visibility av ON av.competitor_id = c.id
            AND av.scanned_at >= now() - INTERVAL '7 days'
        WHERE c.user_id = p_user_id
        GROUP BY c.id, c.name
    ),
    previous AS (
        SELECT
            c.id,
            ROUND(
                (COUNT(*) FILTER (WHERE av.mentioned)::NUMERIC /
                 NULLIF(COUNT(*), 0)::NUMERIC) * 100,
                1
            ) AS pct
        FROM competitors c
        LEFT JOIN aeo_visibility av ON av.competitor_id = c.id
            AND av.scanned_at >= now() - INTERVAL '14 days'
            AND av.scanned_at < now() - INTERVAL '7 days'
        WHERE c.user_id = p_user_id
        GROUP BY c.id
    )
    SELECT
        c.id,
        c.name,
        c.pct AS current_pct,
        COALESCE(p.pct, 0) AS previous_pct,
        (c.pct - COALESCE(p.pct, 0)) AS change_pct
    FROM current c
    LEFT JOIN previous p ON p.id = c.id
    WHERE ABS(c.pct - COALESCE(p.pct, 0)) >= p_min_change_pct
    ORDER BY ABS(c.pct - COALESCE(p.pct, 0)) DESC;
END;
$$;
