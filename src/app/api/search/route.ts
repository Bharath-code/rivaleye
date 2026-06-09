import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { searchCompetitorHistory } from "@/lib/ai/embeddings";
import { parseBody } from "@/lib/validation/schemas";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/csrf";
import { withRequestId, withUser } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

/**
 * POST /api/search
 *
 * Semantic search across the user's competitor history.
 *
 * Request body:
 *   {
 *     query: "which competitors removed their free tier",
 *     threshold?: 0.75,  // cosine similarity 0-1
 *     limit?: 10         // max results
 *   }
 *
 * Response:
 *   { results: SearchResult[] }
 *
 * Each result includes the matching content snippet + the competitor it
 * came from + a similarity score.
 *
 * This is the RAG (Retrieval-Augmented Generation) read path. The
 * LLM-based answer generation is left to the client (so users can
 * stream tokens, copy answers, etc.). This endpoint just retrieves.
 */
const searchSchema = z.object({
    query: z.string().min(3).max(500),
    threshold: z.number().min(0).max(1).optional().default(0.75),
    limit: z.number().int().min(1).max(50).optional().default(10),
});

export async function POST(request: NextRequest) {
    const { log, headers: reqHeaders } = withRequestId(request, "POST /api/search");
    try {
        const csrf = assertSameOrigin(request);
        if (csrf) return csrf;

        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401, headers: reqHeaders }
            );
        }
        const userLog = withUser(log, userId);

        const parsed = await parseBody(request, searchSchema);
        if (parsed.error) {
            return NextResponse.json(
                await parsed.error.json(),
                { status: 400, headers: reqHeaders }
            );
        }
        const { query, threshold, limit } = parsed.data;

        userLog.info({ query: query.slice(0, 50), threshold, limit }, "semantic search");

        const results = await searchCompetitorHistory(userId, query, {
            threshold,
            limit,
        });

        return NextResponse.json(
            { results, query, count: results.length },
            { headers: reqHeaders }
        );
    } catch (err) {
        log.error({ err }, "search failed");
        Sentry.captureException(err);

        // Friendlier error if OpenAI isn't configured
        const message = err instanceof Error ? err.message : "Search failed";
        const isConfigError = message.includes("OPENAI_API_KEY");
        return NextResponse.json(
            {
                error: isConfigError
                    ? "Search is not available — OPENAI_API_KEY not configured."
                    : message,
            },
            { status: isConfigError ? 503 : 500, headers: reqHeaders }
        );
    }
}
