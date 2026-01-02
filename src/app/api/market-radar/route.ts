import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";

/**
 * Market Radar API
 * 
 * GET /api/market-radar
 * Aggregates latest pricing/feature data for all competitors.
 */
export async function GET(request: NextRequest) {
    try {
        const userId = await getUserId();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = createServerClient();

        // 1. Get all competitors for this user
        const { data: competitors, error: compError } = await supabase
            .from("competitors")
            .select("id, name, url")
            .eq("user_id", userId);

        if (compError) {
            console.error("Error fetching competitors for radar:", compError);
            return NextResponse.json({ error: "Failed to fetch competitors" }, { status: 500 });
        }

        if (!competitors || competitors.length === 0) {
            return NextResponse.json({ data: [] });
        }

        const competitorIds = competitors.map(c => c.id);

        // 2. Fetch the LATEST snapshot for each competitor
        // We prioritize 'global' or 'us' context for consistency on the radar
        const { data: snapshots, error: snapError } = await supabase
            .from("pricing_snapshots")
            .select(`
                competitor_id,
                pricing_schema,
                taken_at,
                pricing_contexts!inner(key)
            `)
            .in("competitor_id", competitorIds)
            .order("taken_at", { ascending: false });

        if (snapError) {
            console.error("Error fetching snapshots for radar:", snapError);
            return NextResponse.json({ error: "Failed to fetch market data" }, { status: 500 });
        }

        // 3. Process into Radar Data
        // Map: CompetitorID -> Latest Snapshot
        const latestByCompetitor = new Map();

        for (const snap of snapshots) {
            if (!latestByCompetitor.has(snap.competitor_id)) {
                latestByCompetitor.set(snap.competitor_id, snap);
            }
        }

        const radarData = competitors.map(comp => {
            const snap = latestByCompetitor.get(comp.id);
            if (!snap) return null;

            const schema = snap.pricing_schema;
            const plans = schema?.plans || [];

            // Calculate Feature Density (average features across plans)
            const featureCounts = plans.map((p: any) => p.features?.length || 0);
            const featureDensity = featureCounts.length > 0
                ? featureCounts.reduce((a: number, b: number) => a + b, 0) / featureCounts.length
                : 0;

            // Get Starting Price (cheapest paid plan)
            const prices = plans
                .map((p: any) => {
                    const priceStr = p.price_raw?.replace(/[^0-9.]/g, '');
                    return parseFloat(priceStr || '0');
                })
                .filter((v: number) => v > 0);

            const startingPrice = prices.length > 0 ? Math.min(...prices) : 0;

            return {
                id: comp.id,
                name: comp.name,
                featureDensity,
                startingPrice,
                planCount: plans.length,
                hasFreeTier: schema?.has_free_tier || false,
                lastUpdated: snap.taken_at
            };
        }).filter(Boolean);

        return NextResponse.json({ data: radarData });

    } catch (error) {
        console.error("Unexpected error in market-radar API:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
