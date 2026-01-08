import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";

/**
 * GET /api/competitors/[id]/details
 * 
 * Fetches comprehensive competitor data for the detail page:
 * - Basic info (name, url, status)
 * - Latest analysis data
 * - Pricing snapshots history
 * - Branding, tech stack, performance data
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

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
            return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
        }

        // 2. Get latest analysis
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

        // 5. Extract analysis sections
        const analysisData = latestAnalysis?.analysis_data || null;

        return NextResponse.json({
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
                tagline: analysisData?.tagline || null,
                positioning: analysisData?.positioning || null,
                socialProof: analysisData?.positioning?.socialProof || [],
            },
            techStack: {
                integrations: analysisData?.integrations || [],
                security: analysisData?.security || [],
            },
            performance: {
                // TODO: Add Core Web Vitals when PSI integration is complete
                data: null,
            },
            alerts: recentAlerts || [],
        });
    } catch (error) {
        console.error("[Competitor Details] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
