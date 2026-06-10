import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getVisibilitySummary, runAEOScan } from "@/lib/aeo/scan";
import { createServerClient } from "@/lib/supabase";
import { parseQuery } from "@/lib/validation/schemas";
import { z } from "zod";
import { withRequestId, withUser } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

/**
 * GET /api/aeo/results?competitorId=xxx&windowDays=7
 *
 * Returns the latest AEO visibility summary for a competitor.
 * Includes per-model breakdown + 30-day history.
 */

const querySchema = z.object({
    competitorId: z.string().uuid(),
    windowDays: z.coerce.number().int().min(1).max(90).default(7),
});

export async function GET(request: NextRequest) {
    const { log, headers: reqHeaders } = withRequestId(
        request,
        "GET /api/aeo/results"
    );
    try {
        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401, headers: reqHeaders }
            );
        }
        const userLog = withUser(log, userId);

        const parsed = parseQuery(request, querySchema);
        if (parsed.error) {
            return NextResponse.json(
                await parsed.error.json(),
                { status: 400, headers: reqHeaders }
            );
        }
        const { competitorId, windowDays } = parsed.data;

        // Verify ownership
        const supabase = createServerClient();
        const { data: competitor } = await supabase
            .from("competitors")
            .select("id, name, aeo_queries, aeo_enabled")
            .eq("id", competitorId)
            .eq("user_id", userId)
            .single();

        if (!competitor) {
            return NextResponse.json(
                { error: "Competitor not found" },
                { status: 404, headers: reqHeaders }
            );
        }

        // Get summary
        const summary = await getVisibilitySummary(
            userId,
            competitorId,
            windowDays
        );

        // Get 30-day history (one row per day with avg visibility)
        const thirtyDaysAgo = new Date(
            Date.now() - 30 * 24 * 60 * 60 * 1000
        ).toISOString();

        const { data: history, error: histError } = await supabase
            .from("aeo_visibility")
            .select("scanned_at, mentioned, position, model")
            .eq("competitor_id", competitorId)
            .gte("scanned_at", thirtyDaysAgo)
            .order("scanned_at", { ascending: true });

        if (histError) {
            userLog.error({ err: histError }, "AEO history fetch failed");
        }

        // Aggregate history by day
        const dailyHistory = aggregateByDay(history || []);

        return NextResponse.json(
            {
                competitor: {
                    id: competitor.id,
                    name: competitor.name,
                    aeo_enabled: competitor.aeo_enabled,
                    queries: competitor.aeo_queries,
                },
                window_days: windowDays,
                summary: summary || {
                    total: 0,
                    mentions: 0,
                    visibility_pct: 0,
                    avg_position: null,
                    by_model: [],
                },
                history: dailyHistory,
            },
            { headers: reqHeaders }
        );
    } catch (err) {
        log.error({ err }, "AEO results failed");
        Sentry.captureException(err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500, headers: reqHeaders }
        );
    }
}

/**
 * Aggregate raw scan rows into daily visibility scores.
 */
function aggregateByDay(
    rows: Array<{ scanned_at: string; mentioned: boolean; model: string }>
) {
    const byDay = new Map<
        string,
        { total: number; mentions: number; byModel: Map<string, { total: number; mentions: number }> }
    >();

    for (const row of rows) {
        const day = row.scanned_at.split("T")[0]; // YYYY-MM-DD
        if (!byDay.has(day)) {
            byDay.set(day, {
                total: 0,
                mentions: 0,
                byModel: new Map(),
            });
        }
        const d = byDay.get(day)!;
        d.total++;
        if (row.mentioned) d.mentions++;
        if (!d.byModel.has(row.model)) {
            d.byModel.set(row.model, { total: 0, mentions: 0 });
        }
        const m = d.byModel.get(row.model)!;
        m.total++;
        if (row.mentioned) m.mentions++;
    }

    return Array.from(byDay.entries())
        .map(([date, stats]) => {
            const byModel: Record<
                string,
                { total: number; mentions: number; visibility_pct: number }
            > = {};
            for (const [model, m] of stats.byModel) {
                byModel[model] = {
                    total: m.total,
                    mentions: m.mentions,
                    visibility_pct:
                        m.total > 0
                            ? Math.round((m.mentions / m.total) * 1000) / 10
                            : 0,
                };
            }
            return {
                date,
                total: stats.total,
                mentions: stats.mentions,
                visibility_pct:
                    stats.total > 0
                        ? Math.round((stats.mentions / stats.total) * 1000) / 10
                        : 0,
                by_model: byModel,
            };
        })
        .sort((a, b) => a.date.localeCompare(b.date));
}
