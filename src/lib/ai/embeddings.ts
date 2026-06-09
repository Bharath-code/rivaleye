import OpenAI from "openai";
import { createHash } from "crypto";
import type { CompetitorAnalysis } from "@/lib/ai/visionAnalyzer";
import { createServerClient } from "@/lib/supabase";

/**
 * Competitor Embeddings (RAG)
 *
 * After every analysis, we embed a compact "summary" of the change
 * and store it in `competitor_embeddings` (pgvector). Users can then
 * semantically search across all their competitor history:
 *
 *   "which competitors removed their free tier"
 *   "competitors that raised prices in the last 6 months"
 *   "tools that switched from monthly to annual billing"
 *
 * Model: text-embedding-3-small
 *  - 1536 dimensions
 *  - $0.02 per 1M tokens (~$0.00002 per embedding)
 *  - ~10K competitors analyzed/month = ~$0.20/mo
 *
 * The embedded "content" is a compact text block, not the full raw
 * analysis. We pick the most semantically dense fields:
 *   - summary (1 line)
 *   - pricing plan names + prices
 *   - new/changed features
 *   - positioning
 *
 * Failure modes are all non-fatal: if OpenAI is down, we skip
 * embedding — the alert still fires. RAG is enhancement, not critical path.
 */

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI | null {
    if (openaiClient) return openaiClient;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    openaiClient = new OpenAI({ apiKey });
    return openaiClient;
}

/**
 * Build a compact, embedding-friendly text summary from an analysis.
 * ~200-400 tokens typically — small enough to embed cheaply,
 * rich enough to be semantically meaningful.
 */
export function buildEmbeddingContent(
    analysis: CompetitorAnalysis,
    competitorName: string
): string {
    const parts: string[] = [];

    if (analysis.summary) {
        parts.push(`Summary: ${analysis.summary}`);
    }

    if (analysis.positioning?.valueProposition) {
        parts.push(`Positioning: ${analysis.positioning.valueProposition}`);
    }

    if (analysis.pricing?.plans?.length) {
        const plans = analysis.pricing.plans
            .map((p) => `${p.name}: ${p.price}`)
            .join("; ");
        parts.push(`Pricing plans: ${plans}`);
        if (analysis.pricing.currency) {
            parts.push(`Currency: ${analysis.pricing.currency}`);
        }
    }

    if (analysis.features?.highlighted?.length) {
        parts.push(`Highlighted features: ${analysis.features.highlighted.join(", ")}`);
    }

    if (analysis.insights?.length) {
        parts.push(`Insights: ${analysis.insights.join(" | ")}`);
    }

    // Header so searches for "<competitor name>" hit this row
    return `${competitorName}\n\n${parts.join("\n")}`;
}

/**
 * Generate embedding for a single text. Returns null on any failure
 * (network, missing key, rate limit) — callers must treat null as
 * "skip silently" and not throw.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
    const client = getClient();
    if (!client) {
        // OpenAI not configured — feature is optional
        return null;
    }

    try {
        const response = await client.embeddings.create({
            model: EMBEDDING_MODEL,
            input: text,
        });
        const embedding = response.data[0]?.embedding;
        if (!embedding || embedding.length !== EMBEDDING_DIMS) {
            return null;
        }
        return embedding;
    } catch (err) {
        console.error("[Embeddings] generation failed:", err);
        return null;
    }
}

/**
 * Embed a competitor analysis and store it in pgvector.
 * Fire-and-forget: returns immediately, logs errors but doesn't throw.
 *
 * @param userId - owner of the competitor (for RLS)
 * @param competitorId - FK to competitors
 * @param analysisId - FK to the just-inserted analysis row
 * @param analysis - the analysis data
 * @param competitorName - for human-readable content
 */
export async function embedAndStoreAnalysis(
    userId: string,
    competitorId: string,
    analysisId: string,
    analysis: CompetitorAnalysis,
    competitorName: string
): Promise<void> {
    try {
        const content = buildEmbeddingContent(analysis, competitorName);
        const embedding = await generateEmbedding(content);
        if (!embedding) return;

        const supabase = createServerClient();
        const { error } = await supabase.from("competitor_embeddings").insert({
            user_id: userId,
            competitor_id: competitorId,
            analysis_id: analysisId,
            content,
            embedding: JSON.stringify(embedding), // pgvector accepts JSON string
        });

        if (error) {
            console.error("[Embeddings] store failed:", error);
        }
    } catch (err) {
        // Non-fatal — alerts still fire
        console.error("[Embeddings] unexpected error:", err);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// Semantic Search
// ══════════════════════════════════════════════════════════════════════════════

export interface SearchResult {
    id: string;
    competitor_id: string;
    competitor_name: string;
    competitor_url: string;
    analysis_id: string;
    content: string;
    similarity: number;
    created_at: string;
}

/**
 * Semantic search across the user's competitor history.
 * Returns the top N matches above the similarity threshold.
 *
 * Threshold guide:
 *   0.85+  → near-exact match
 *   0.75+  → strong semantic match (default)
 *   0.65+  → loose match (might be noisy)
 */
export async function searchCompetitorHistory(
    userId: string,
    query: string,
    options: { threshold?: number; limit?: number } = {}
): Promise<SearchResult[]> {
    const { threshold = 0.75, limit = 10 } = options;
    const client = getClient();
    if (!client) {
        throw new Error("OPENAI_API_KEY is not configured");
    }

    const supabase = createServerClient();

    // 1. Embed the query
    const queryEmbedding = await generateEmbedding(query);
    if (!queryEmbedding) {
        throw new Error("Failed to generate query embedding");
    }

    // 2. Call the RPC function
    const { data, error } = await supabase.rpc("match_competitor_embeddings", {
        query_embedding: JSON.stringify(queryEmbedding),
        match_user_id: userId,
        match_threshold: threshold,
        match_count: limit,
    });

    if (error) {
        console.error("[Search] RPC failed:", error);
        throw new Error("Search failed");
    }

    if (!data || data.length === 0) {
        return [];
    }

    // 3. Hydrate with competitor names
    const competitorIds = [...new Set(data.map((r: { competitor_id: string }) => r.competitor_id))];
    const { data: competitors } = await supabase
        .from("competitors")
        .select("id, name, url")
        .in("id", competitorIds);

    const competitorMap = new Map(
        (competitors || []).map((c) => [c.id, c])
    );

    return (data as Array<{
        id: string;
        competitor_id: string;
        analysis_id: string;
        content: string;
        similarity: number;
        created_at: string;
    }>).map((row) => {
        const comp = competitorMap.get(row.competitor_id);
        return {
            id: row.id,
            competitor_id: row.competitor_id,
            competitor_name: comp?.name || "Unknown",
            competitor_url: comp?.url || "",
            analysis_id: row.analysis_id,
            content: row.content,
            similarity: row.similarity,
            created_at: row.created_at,
        };
    });
}

/**
 * Hash of embedding content — used to skip re-embedding unchanged content.
 * (Not currently used, but useful for deduplication if you ever want to
 * avoid the cost of re-embedding identical analyses.)
 */
export function contentHash(content: string): string {
    return createHash("sha256").update(content).digest("hex").slice(0, 16);
}
