-- PAR-1: own-brand share-of-voice. The user's own brand mention is checked
-- against the SAME model responses as the competitor's (no extra LLM cost).
-- own_mentioned is NULL when the user had no brand configured at scan time.
ALTER TABLE aeo_visibility
    ADD COLUMN IF NOT EXISTS own_mentioned BOOLEAN,
    ADD COLUMN IF NOT EXISTS own_position INTEGER;

-- Free public AI-visibility checker: 24h per-(domain,brand) result cache so
-- repeat checks (and abuse retries) cost zero LLM spend.
CREATE TABLE IF NOT EXISTS public_aeo_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key TEXT NOT NULL,
    result JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_aeo_checks_key
    ON public_aeo_checks(cache_key, created_at DESC);

-- RLS with zero policies: blocks anon/authenticated roles from reading or
-- writing this table directly via PostgREST (no legitimate direct-client
-- access path exists — it's an internal cache for /api/public/aeo-check).
-- Without this, the default PostgREST grants would let anyone with the
-- public anon key read all cached brand/URL pairs or insert fabricated
-- `result` JSON to poison the cache, bypassing the route's rate limit
-- entirely. `createServerClient()` uses the service-role key, which
-- bypasses RLS as usual, so app code is unaffected.
ALTER TABLE public_aeo_checks ENABLE ROW LEVEL SECURITY;
