import { NextRequest, NextResponse } from "next/server";
import { triggerManualCheck } from "@/trigger/dailyPricingAnalysis";
import { deepAuditTask } from "@/trigger/deepAudit";
import { createServerClient } from "@/lib/supabase";

/**
 * ⚠️ TEST ONLY: Full Cycle Verification
 * 
 * Triggers both pricing and deep audit tasks for a competitor.
 */
export async function POST(req: NextRequest) {
    try {
        const { competitorId } = await req.json();

        if (!competitorId) {
            return NextResponse.json({ error: "Missing competitorId" }, { status: 400 });
        }

        const supabase = createServerClient();

        // Get competitor details
        const { data: competitor } = await supabase
            .from("competitors")
            .select("*, users(plan)")
            .eq("id", competitorId)
            .single();

        if (!competitor) {
            return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
        }

        const userPlan = (competitor.users?.[0]?.plan || "pro") as "free" | "pro" | "enterprise";

        console.log(`[Test] Triggering full cycle for ${competitor.name}`);

        // 1. Trigger Pricing Check (via dailyPricingAnalysis helper)
        const pricingResult = await triggerManualCheck(competitorId, ["us"]);

        // 2. Trigger Deep Audit (Manual trigger)
        const auditResult = await deepAuditTask.trigger({
            competitorId,
            competitorUrl: competitor.url,
            competitorName: competitor.name,
            userId: competitor.user_id,
            userPlan,
        });

        return NextResponse.json({
            success: true,
            pricingTriggered: pricingResult.triggered,
            auditTriggered: auditResult.id,
            competitor: competitor.name,
        });
    } catch (error) {
        console.error("[Test] Full cycle error:", error);
        return NextResponse.json({ error: "Test trigger failed" }, { status: 500 });
    }
}
