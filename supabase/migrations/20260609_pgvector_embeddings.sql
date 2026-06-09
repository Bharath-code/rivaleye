-- ══════════════════════════════════════════════════════════════════════════════
-- PGVECTOR + COMPETITOR EMBEDDINGS (RAG FEATURE)
-- Run in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Enable the pgvector extension (built-in to Supabase, no extra setup)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Embeddings table
--    - One row per analysis (links to competitor_id for ownership scoping)
--    - 1536 dimensions matches OpenAI text-embedding-3-small
--    - Indexed with IVFFlat for fast cosine-similarity search
CREATE TABLE IF NOT EXISTS competitor_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    content TEXT NOT NULL,                    -- the source text that was embedded
    embedding vector(1536),                  -- the embedding vector
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_competitor_embeddings_competitor
    ON competitor_embeddings(competitor_id);
CREATE INDEX IF NOT EXISTS idx_competitor_embeddings_user
    ON competitor_embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_competitor_embeddings_created
    ON competitor_embeddings(created_at DESC);

-- 4. IVFFlat index for fast similarity search
--    NOTE: requires at least ~1000 rows to be effective. For smaller
--    datasets Postgres will fall back to sequential scan which is fine.
--    lists=100 is a good default for <100K rows.
CREATE INDEX IF NOT EXISTS idx_competitor_embeddings_vector
    ON competitor_embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- 5. RPC function: semantic search with user-scope + similarity threshold
--    Returns top N matches filtered by the calling user (RLS-friendly).
CREATE OR REPLACE FUNCTION match_competitor_embeddings(
    query_embedding vector(1536),
    match_user_id UUID,
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    competitor_id UUID,
    analysis_id UUID,
    content TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ce.id,
        ce.competitor_id,
        ce.analysis_id,
        ce.content,
        1 - (ce.embedding <=> query_embedding) AS similarity
    FROM competitor_embeddings ce
    WHERE ce.user_id = match_user_id
      AND 1 - (ce.embedding <=> query_embedding) > match_threshold
    ORDER BY ce.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 6. Enable RLS
ALTER TABLE competitor_embeddings ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies (same pattern as competitors/alerts)
CREATE POLICY "Users can read their own embeddings"
    ON competitor_embeddings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can write embeddings"
    ON competitor_embeddings FOR INSERT
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can delete embeddings"
    ON competitor_embeddings FOR DELETE
    USING (auth.jwt() ->> 'role' = 'service_role');
