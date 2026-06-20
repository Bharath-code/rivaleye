# Setup notes for the RAG + Realtime features

## 1. Apply the pgvector migration

Run in Supabase SQL Editor (Dashboard → SQL Editor → New query):

```sql
-- Paste the contents of: supabase/migrations/20260609_pgvector_embeddings.sql
```

This creates:
- `vector` extension
- `competitor_embeddings` table
- IVFFlat index for fast similarity search
- `match_competitor_embeddings()` RPC function
- RLS policies (users see only their own embeddings)

## 2. Enable Realtime on the `alerts` table

In Supabase Dashboard:
1. Go to **Database → Replication**
2. Find the `alerts` table
3. Toggle **Insert** under "Events to broadcast"
4. Click Save

This enables the `postgres_changes` channel used by `useRealtimeAlerts`.

## 3. Set the OpenAI API key

```bash
# In .env.local
OPENAI_API_KEY=sk-...
```

Without this, semantic search returns a friendly 503 and the embedding
generation in analyze-competitor is silently skipped (alerts still work).

## 4. Cost check

- Embeddings: ~$0.00002 per analysis
- Search: ~$0.00002 per query (1 embedding call)
- At 1000 Pro users × 5 competitors × 1 daily analysis = 5000 embeddings/day
  = **$0.10/day = $3/month** in OpenAI costs. Negligible.
- Search at 10 queries/user/day × 1000 users = 10K queries/day = **$6/month**.
- Total: **~$9/month** for the entire RAG feature at 1K users.

## 5. Verify the RPC works

After applying the migration, test in Supabase SQL Editor:

```sql
-- Should return one row (a placeholder)
SELECT * FROM match_competitor_embeddings(
    array_fill(0.1, ARRAY[1536])::vector,
    (SELECT id FROM users LIMIT 1),
    0.0,    -- threshold (0.0 = return everything)
    5
);
```

If you get an empty result set, the function is working — just no
embeddings exist yet. Trigger an analysis to generate one.
