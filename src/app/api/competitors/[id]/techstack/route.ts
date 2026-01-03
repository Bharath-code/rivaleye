import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { getFeatureFlags } from "@/lib/billing/featureFlags";
import { detectTechStack, compareTechStacks, type DetectedTech } from "@/lib/crawler/techStackDetector";
import { analyzeTechStackChanges, createTechStackAlerts } from "@/lib/alerts/techStackAlerts";

/**
 * Tech Stack Detection API
 *
 * GET - Retrieve stored tech stack for a competitor
 * POST - Trigger tech stack detection (Pro feature)
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

        // Verify competitor ownership
        const { data: competitor } = await supabase
            .from("competitors")
            .select("id, name, url")
            .eq("id", competitorId)
            .eq("user_id", userId)
            .single();

        if (!competitor) {
            return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
        }

        // Get stored tech stack data
        const { data: techStack } = await supabase
            .from("competitor_techstack")
            .select("*")
            .eq("competitor_id", competitorId)
            .order("extracted_at", { ascending: false })
            .limit(1)
            .single();

        if (!techStack) {
            return NextResponse.json({
                techStack: null,
                message: "No tech stack data available. Trigger detection with POST.",
            });
        }

        return NextResponse.json({
            techStack: techStack.technologies,
            summary: techStack.summary,
            extractedAt: techStack.extracted_at,
            competitorName: competitor.name,
        });
    } catch (error) {
        console.error("[TechStack API] GET error:", error);
        return NextResponse.json({ error: "Failed to fetch tech stack" }, { status: 500 });
    }
}

export async function POST(
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

        // Get user plan
        const { data: user } = await supabase
            .from("users")
            .select("plan")
            .eq("id", userId)
            .single();

        // Check Pro feature access
        const flags = getFeatureFlags(user?.plan || "free");
        if (!flags.canViewAiInsights) {
            return NextResponse.json(
                {
                    error: "Tech stack detection is a Pro feature",
                    upgradeRequired: true,
                },
                { status: 403 }
            );
        }

        // Verify competitor ownership
        const { data: competitor } = await supabase
            .from("competitors")
            .select("id, name, url")
            .eq("id", competitorId)
            .eq("user_id", userId)
            .single();

        if (!competitor) {
            return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
        }

        // Detect tech stack
        console.log(`[TechStack API] Detecting tech stack for: ${competitor.url}`);
        const result = await detectTechStack(competitor.url);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error, code: result.code },
                { status: 422 }
            );
        }

        // Get previous tech stack for comparison
        const { data: previousStack } = await supabase
            .from("competitor_techstack")
            .select("technologies")
            .eq("competitor_id", competitorId)
            .order("extracted_at", { ascending: false })
            .limit(1)
            .single();

        // Compare with previous if exists and create alerts
        let diff = null;
        let alerts: Awaited<ReturnType<typeof analyzeTechStackChanges>> = [];
        if (previousStack?.technologies) {
            const oldTech = previousStack.technologies as DetectedTech[];
            diff = compareTechStacks(oldTech, result.technologies);

            // Analyze changes and create semantic alerts (now async with AI fallback)
            alerts = await analyzeTechStackChanges(oldTech, result.technologies);
            if (alerts.length > 0) {
                await createTechStackAlerts(userId, competitorId, competitor.name, alerts);
                console.log(`[TechStack API] Created ${alerts.length} tech stack alerts`);
            }
        }

        // Store new tech stack
        const { error: insertError } = await supabase
            .from("competitor_techstack")
            .insert({
                competitor_id: competitorId,
                technologies: result.technologies,
                summary: result.summary,
                extracted_at: new Date().toISOString(),
            });

        if (insertError) {
            console.error("[TechStack API] Insert error:", insertError);
        }

        return NextResponse.json({
            success: true,
            techStack: result.technologies,
            summary: result.summary,
            diff,
            alerts: alerts.length > 0 ? alerts : null,
            competitorName: competitor.name,
        });

    } catch (error) {
        console.error("[TechStack API] POST error:", error);
        return NextResponse.json({ error: "Failed to detect tech stack" }, { status: 500 });
    }
}
