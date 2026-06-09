import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { withRequestId, withUser } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

/**
 * GET /api/competitors/[id]/details
 *
 * Fetches comprehensive competitor data for the detail page.
 * Reads from the geo-aware tables (competitor_performance, competitor_techstack,
 * competitor_branding) when present — falls back to legacy analyses.analysis_data
 * for older competitors.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { log, headers: reqHeaders } = withRequestId(request, "GET /api/competitors/[id]/details");
    try {
        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401, headers: reqHeaders }
            );
        }
        const userLog = withUser(log, userId);

        const { id: competitorId } = await params;
        const supabase = createServerClient();

        // 1. Get competitor basic info
        const { data: competitor, error: compError } = await supabase
            .from("competitors")
            .select("*")
            .eq("id", competitorId)
            .eq("user_id", userId)
            .single();

        if (compError || !competitor) {
            userLog.warn({ competitorId }, "competitor not found");
            return NextResponse.json(
                { error: "Competitor not found" },
                { status: 404, headers: reqHeaders }
            );
        }

        // 2. Get latest analysis (for pricing/positioning summary)
        const { data: latestAnalysis } = await supabase
            .from("analyses")
            .select("*")
            .eq("competitor_id", competitorId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        // 3. Get pricing snapshots (for trend chart)
        const { data: pricingSnapshots } = await supabase
            .from("pricing_snapshots")
            .select(`
                id,
                pricing_schema,
                currency_detected,
                taken_at,
                pricing_contexts(key)
            `)
            .eq("competitor_id", competitorId)
            .order("taken_at", { ascending: false })
            .limit(10);

        // 4. Get recent alerts
        const { data: recentAlerts } = await supabase
            .from("alerts")
            .select("*")
            .eq("competitor_id", competitorId)
            .order("created_at", { ascending: false })
            .limit(5);

        // 5. Read from the 3 geo-aware tables (latest of each)
        const [latestPerformance, latestTechStack, latestBranding] = await Promise.all([
            supabase
                .from("competitor_performance")
                .select("*")
                .eq("competitor_id", competitorId)
                .order("extracted_at", { ascending: false })
                .limit(1)
                .maybeSingle(),
            supabase
                .from("competitor_techstack")
                .select("*")
                .eq("competitor_id", competitorId)
                .order("extracted_at", { ascending: false })
                .limit(1)
                .maybeSingle(),
            supabase
                .from("competitor_branding")
                .select("*")
                .eq("competitor_id", competitorId)
                .order("extracted_at", { ascending: false })
                .limit(1)
                .maybeSingle(),
        ]);

        const analysisData = latestAnalysis?.analysis_data || null;

        // 6. Compose the response — table data takes precedence, fall back to analysis_data
        return NextResponse.json(
            {
                competitor,
                analysis: {
                    data: analysisData,
                    timestamp: latestAnalysis?.created_at || null,
                    hasChanges: latestAnalysis?.has_changes || false,
                },
                pricing: {
                    current: analysisData?.pricing || null,
                    history: pricingSnapshots || [],
                },
                branding: {
                    data: latestBranding.data?.branding_data || null,
                    tagline: analysisData?.tagline || null,
                    positioning: analysisData?.positioning || null,
                    socialProof: analysisData?.positioning?.socialProof || [],
                    extractedAt: latestBranding.data?.extracted_at || null,
                },
                techStack: {
                    data: latestTechStack.data?.techstack_data || null,
                    integrations: analysisData?.integrations || [],
                    security: analysisData?.security || [],
                    extractedAt: latestTechStack.data?.extracted_at || null,
                },
                performance: {
                    data: latestPerformance.data?.insights || null,
                    score: latestPerformance.data?.performance_score || null,
                    extractedAt: latestPerformance.data?.extracted_at || null,
                },
                alerts: recentAlerts || [],
            },
            { headers: reqHeaders }
        );
    } catch (err) {
        log.error({ err }, "unexpected error in GET /api/competitors/[id]/details");
        Sentry.captureException(err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500, headers: reqHeaders }
        );
    }
}
