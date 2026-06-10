import { createServerClient } from "@/lib/supabase";
import { queryModel, type ModelName, type AEOResponse } from "./providers";
import { isBrandMentioned } from "./parser";
import { generateDefaultQueries, type CompetitorInput } from "./queries";
import { logger } from "@/lib/logger";

/**
 * AEO Orchestrator
 *
 * High-level "run a scan" function that:
 *  1. Loads the competitor
 *  2. Generates queries (or uses the user's custom set)
 *  3. Queries each LLM in parallel
 *  4. Parses the response for brand mentions
 *  5. Persists results to aeo_visibility
 *  6. Returns a summary
 *
 * The orchestrator is called from:
 *  - /api/aeo/track (manual, user-triggered)
 *  - trigger/aeoMonitor.ts (daily cron)
 */

export interface ScanResult {
    competitor_id: string;
    competitor_name: string;
    queries: number;
    models: number;
    total_mentions: number;
    visibility_pct: number;
    cost_usd: number;
    duration_ms: number;
    errors: string[];
}

/**
 * Run a full AEO scan for a single competitor.
 *
 * @param userId - the user requesting the scan
 * @param competitorId - the competitor to scan
 * @param options - override defaults (queries, models, etc.)
 */
export async function runAEOScan(
    userId: string,
    competitorId: string,
    options: {
        queries?: string[];
        models?: ModelName[];
        /** If true, scan runs synchronously (caller waits). If false, returns immediately and runs in background. */
        sync?: boolean;
    } = {}
): Promise<ScanResult> {
    const start = Date.now();
    const supabase = createServerClient();

    // 1. Load competitor
    const { data: competitor, error: compError } = await supabase
        .from("competitors")
        .select("id, name, url, aeo_queries, aeo_enabled")
        .eq("id", competitorId)
        .eq("user_id", userId)
        .single();

    if (compError || !competitor) {
        throw new Error("Competitor not found");
    }
    if (!competitor.aeo_enabled) {
        throw new Error("AEO monitoring is disabled for this competitor");
    }

    // 2. Determine queries
    const queries =
        options.queries ??
        (Array.isArray(competitor.aeo_queries) && competitor.aeo_queries.length > 0
            ? competitor.aeo_queries
            : generateDefaultQueries({
                  name: competitor.name,
                  url: competitor.url,
              }));

    // 3. Determine models — default to all 5
    const models: ModelName[] =
        options.models ?? ["chatgpt", "perplexity", "claude", "gemini", "google_ai"];

    logger.info(
        { competitorId, queries: queries.length, models: models.length },
        "AEO scan starting"
    );

    // 4. Run queries in parallel (5 models × N queries)
    const tasks: Array<{
        model: ModelName;
        query: string;
        promise: Promise<{ response: AEOResponse | null; latency: number }>;
    }> = [];

    for (const query of queries) {
        for (const model of models) {
            const task = (async () => {
                const t0 = Date.now();
                const response = await queryModel(model, {
                    prompt: query,
                    competitorName: competitor.name,
                });
                return { response, latency: Date.now() - t0 };
            })();
            tasks.push({ model, query, promise: task });
        }
    }

    // Wait for all
    const results = await Promise.allSettled(tasks.map((t) => t.promise));

    // 5. Parse + persist
    const rows: Array<{
        user_id: string;
        competitor_id: string;
        query: string;
        model: ModelName;
        mentioned: boolean;
        position: number | null;
        response_excerpt: string | null;
        citations: string[];
        cost_usd: number;
        scanned_at: string;
        latency_ms: number;
    }> = [];

    let totalMentions = 0;
    let totalCost = 0;
    const errors: string[] = [];

    for (let i = 0; i < tasks.length; i++) {
        const { model, query } = tasks[i];
        const settled = results[i];
        if (settled.status === "rejected" || !settled.value.response) {
            errors.push(`${model} failed for "${query.slice(0, 30)}..."`);
            continue;
        }
        const r = settled.value.response;
        const check = isBrandMentioned(
            r.response_text,
            r.citations,
            competitor.name,
            competitor.url
        );
        if (check.mentioned) totalMentions++;
        totalCost += r.cost_usd;

        rows.push({
            user_id: userId,
            competitor_id: competitorId,
            query,
            model,
            mentioned: check.mentioned,
            position: check.position,
            response_excerpt: r.response_text,
            citations: r.citations,
            cost_usd: r.cost_usd,
            scanned_at: new Date().toISOString(),
            latency_ms: r.latency_ms,
        });
    }

    // 6. Batch insert
    if (rows.length > 0) {
        const { error: insertError } = await supabase
            .from("aeo_visibility")
            .insert(rows);
        if (insertError) {
            logger.error({ err: insertError, rowCount: rows.length }, "AEO insert failed");
        }
    }

    // 7. Auto-generate queries for the competitor (if not already set)
    if (
        !competitor.aeo_queries ||
        (Array.isArray(competitor.aeo_queries) && competitor.aeo_queries.length === 0)
    ) {
        const defaultQueries = generateDefaultQueries({
            name: competitor.name,
            url: competitor.url,
        });
        await supabase
            .from("competitors")
            .update({ aeo_queries: defaultQueries })
            .eq("id", competitorId);
    }

    const duration = Date.now() - start;
    const visibilityPct =
        rows.length > 0
            ? Math.round((totalMentions / rows.length) * 1000) / 10
            : 0;

    logger.info(
        {
            competitorId,
            queries: queries.length,
            models: models.length,
            mentions: totalMentions,
            cost: totalCost,
            duration_ms: duration,
        },
        "AEO scan complete"
    );

    return {
        competitor_id: competitorId,
        competitor_name: competitor.name,
        queries: queries.length,
        models: models.length,
        total_mentions: totalMentions,
        visibility_pct: visibilityPct,
        cost_usd: Math.round(totalCost * 10000) / 10000,
        duration_ms: duration,
        errors,
    };
}

/**
 * Get the latest visibility summary for a competitor.
 */
export interface VisibilitySummary {
    total: number;
    mentions: number;
    visibility_pct: number;
    avg_position: number | null;
    by_model: Array<{
        model: ModelName;
        total: number;
        mentions: number;
        visibility_pct: number;
        avg_position: number | null;
    }>;
}

export async function getVisibilitySummary(
    userId: string,
    competitorId: string,
    windowDays: number = 7
): Promise<VisibilitySummary | null> {
    const supabase = createServerClient();
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

    // Use the RPC function we defined in the migration
    const { data: overall, error: rpcError } = await supabase.rpc(
        "get_competitor_visibility",
        {
            p_competitor_id: competitorId,
            p_since: since,
        }
    );

    if (rpcError) {
        logger.error({ err: rpcError }, "AEO visibility RPC failed");
        return null;
    }

    const { data: byModel, error: modelError } = await supabase.rpc(
        "get_competitor_visibility_by_model",
        {
            p_competitor_id: competitorId,
            p_since: since,
        }
    );

    if (modelError) {
        logger.error({ err: modelError }, "AEO by-model RPC failed");
    }

    const o = overall?.[0] || {
        total_queries: 0,
        mentions: 0,
        visibility_pct: 0,
        avg_position: null,
    };

    return {
        total: Number(o.total_queries),
        mentions: Number(o.mentions),
        visibility_pct: Number(o.visibility_pct),
        avg_position: o.avg_position ? Number(o.avg_position) : null,
        by_model: (byModel || []).map((row: Record<string, unknown>) => ({
            model: row.model as ModelName,
            total: Number(row.total_queries),
            mentions: Number(row.mentions),
            visibility_pct: Number(row.visibility_pct),
            avg_position: row.avg_position ? Number(row.avg_position) : null,
        })),
    };
}
