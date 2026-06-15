import { NextRequest, NextResponse } from "next/server";
import { triggerManualCheck } from "@/trigger/dailyPricingAnalysis";
import { deepAuditTask } from "@/trigger/deepAudit";
import { createServerClient } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

/**
 * ⚠️ TEST ONLY: Full Cycle Verification
 *
 * Triggers both pricing and deep audit tasks for a competitor.
 *
 * Hardened (SEC-1): disabled in production, and in non-prod requires
 * a same-origin authenticated request whose user OWNS the competitor,
 * behind a rate limit. Previously this was unauthenticated and could be
 * used to burn Firecrawl + AI budget for any competitorId.
 */
export async function POST(req: NextRequest) {
    // Hard off-switch in production.
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    try {
        const csrf = assertSameOrigin(req);
        if (csrf) return csrf;

        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const rate = await checkRateLimit(`test-full-cycle:${userId}`, RATE_LIMITS.analysis);
        if (!rate.allowed) {
            return NextResponse.json(
                { error: "Too many requests" },
                { status: 429 }
            );
        }

        const { competitorId } = await req.json();

        if (!competitorId) {
            return NextResponse.json({ error: "Missing competitorId" }, { status: 400 });
        }

        const supabase = createServerClient();

        // Get competitor details — scoped to the caller (ownership check).
        const { data: competitor } = await supabase
            .from("competitors")
            .select("*, users(plan)")
            .eq("id", competitorId)
            .eq("user_id", userId)
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
