import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";

/**
 * Competitor Pricing History API
 * 
 * GET /api/competitors/[id]/history
 * Returns chronological pricing data for graphing.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const userId = await getUserId();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = createServerClient();

        // 1. Verify ownership
        const { data: competitor, error: compError } = await supabase
            .from("competitors")
            .select("user_id, name")
            .eq("id", id)
            .single();

        if (compError || !competitor) {
            return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
        }

        if (competitor.user_id !== userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // 2. Fetch history
        // We join with pricing_contexts to filter by context if needed (default to 'global' or 'us')
        const { data: snapshots, error: snapError } = await supabase
            .from("pricing_snapshots")
            .select(`
                id,
                taken_at,
                pricing_schema,
                pricing_contexts (
                    key,
                    currency
                )
            `)
            .eq("competitor_id", id)
            .order("taken_at", { ascending: true });

        if (snapError) {
            console.error("Error fetching history:", snapError);
            return NextResponse.json({ error: "Failed to fetch pricing history" }, { status: 500 });
        }

        return NextResponse.json({
            competitorName: competitor.name,
            history: snapshots.map((s: any) => ({
                id: s.id,
                date: s.taken_at,
                context: s.pricing_contexts?.key || "unknown",
                currency: s.pricing_contexts?.currency || "USD",
                plans: s.pricing_schema?.plans || []
            }))
        });
    } catch (error) {
        console.error("Unexpected error in history API:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
