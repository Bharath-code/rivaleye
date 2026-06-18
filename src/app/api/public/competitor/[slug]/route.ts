import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/public/competitor/[slug]
 *
 * Returns public-safe competitor data for the public tracker page
 * (no auth required). Used by /track/[slug] for the viral wedge.
 *
 * Slug format: derived from URL hostname (e.g. "stripe.com" → "stripe-com").
 *
 * Returns:
 *  - 200 with { competitor, latestAnalysis, history, branding } on hit
 *  - 404 if no competitor with that hostname has been analyzed
 *  - 500 on server error
 *
 * NOTE: We use the service role key to bypass RLS — the response only
 * contains public-safe fields (no user_id, no settings, no PII).
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    const normalized = slug.toLowerCase().trim();

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json(
            { error: "Service not configured" },
            { status: 500 }
        );
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Indexed lookup by public_slug (SEC-4/PERF-1) — replaces the old 500-row
    // in-memory scan. Only rows explicitly listed for public exposure match.
    const { data: matches, error } = await supabase
        .from("competitors")
        .select("id, name, url, status, last_checked_at, created_at")
        .eq("public_slug", normalized)
        .eq("status", "active")
        .eq("public_listed", true)
        .limit(1);

    if (error) {
        console.error("[Public Tracker] DB error:", error);
        return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    }

    const match = matches?.[0];

    if (!match) {
        return NextResponse.json(
            { error: "No tracked competitor matches that URL" },
            { status: 404 }
        );
    }

    // Fetch latest analysis + recent snapshots
    const [latestAnalysisRes, historyRes] = await Promise.all([
        supabase
            .from("analyses")
            .select("analysis_data, created_at, has_changes")
            .eq("competitor_id", match.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase
            .from("pricing_snapshots")
            .select("pricing_schema, currency_detected, taken_at")
            .eq("competitor_id", match.id)
            .order("taken_at", { ascending: false })
            .limit(7),
    ]);

    const latestAnalysis = latestAnalysisRes.data;
    const history = historyRes.data || [];

    return NextResponse.json(
        {
            competitor: {
                name: match.name,
                url: match.url,
                lastCheckedAt: match.last_checked_at,
            },
            latestAnalysis: latestAnalysis
                ? {
                    summary: latestAnalysis.analysis_data?.summary || null,
                    pricing: latestAnalysis.analysis_data?.pricing || null,
                    positioning: latestAnalysis.analysis_data?.positioning || null,
                    timestamp: latestAnalysis.created_at,
                    hasChanges: latestAnalysis.has_changes,
                }
                : null,
            history: history.map((h) => ({
                pricing: h.pricing_schema,
                currency: h.currency_detected,
                takenAt: h.taken_at,
            })),
        },
        {
            headers: {
                // Edge cache for 5 min (per PRD)
                "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
            },
        }
    );
}
