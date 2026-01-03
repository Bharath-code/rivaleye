import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { getFeatureFlags } from "@/lib/billing/featureFlags";
import { extractBranding, compareBranding, type ExtractedBranding } from "@/lib/crawler/brandingExtractor";
import { analyzeBrandingChanges, createBrandingAlerts } from "@/lib/alerts/brandingAlerts";

/**
 * Branding Extraction API
 *
 * GET - Retrieve stored branding for a competitor
 * POST - Trigger branding extraction (Pro feature)
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

        // Get stored branding data
        const { data: branding } = await supabase
            .from("competitor_branding")
            .select("*")
            .eq("competitor_id", competitorId)
            .order("extracted_at", { ascending: false })
            .limit(1)
            .single();

        if (!branding) {
            return NextResponse.json({
                branding: null,
                message: "No branding data available. Trigger extraction with POST.",
            });
        }

        return NextResponse.json({
            branding: branding.branding_data,
            extractedAt: branding.extracted_at,
            competitorName: competitor.name,
        });
    } catch (error) {
        console.error("[Branding API] GET error:", error);
        return NextResponse.json({ error: "Failed to fetch branding" }, { status: 500 });
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
                    error: "Branding extraction is a Pro feature",
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

        // Extract branding
        console.log(`[Branding API] Extracting branding for: ${competitor.url}`);
        const result = await extractBranding(competitor.url);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error, code: result.code },
                { status: 422 }
            );
        }

        // Get previous branding for comparison
        const { data: previousBranding } = await supabase
            .from("competitor_branding")
            .select("branding_data")
            .eq("competitor_id", competitorId)
            .order("extracted_at", { ascending: false })
            .limit(1)
            .single();

        // Compare with previous if exists and create alerts
        let diff = null;
        let alerts: ReturnType<typeof analyzeBrandingChanges> = [];
        if (previousBranding?.branding_data) {
            const oldBranding = previousBranding.branding_data as ExtractedBranding;
            diff = compareBranding(oldBranding, result.branding);

            // Analyze changes and create semantic alerts
            alerts = analyzeBrandingChanges(oldBranding, result.branding);
            if (alerts.length > 0) {
                await createBrandingAlerts(userId, competitorId, competitor.name, alerts);
                console.log(`[Branding API] Created ${alerts.length} branding alerts`);
            }
        }

        // Store new branding
        const { error: insertError } = await supabase
            .from("competitor_branding")
            .insert({
                competitor_id: competitorId,
                branding_data: result.branding,
                extracted_at: new Date().toISOString(),
            });

        if (insertError) {
            console.error("[Branding API] Insert error:", insertError);
        }

        return NextResponse.json({
            success: true,
            branding: result.branding,
            diff,
            alerts: alerts.length > 0 ? alerts : null,
            competitorName: competitor.name,
        });
    } catch (error) {
        console.error("[Branding API] POST error:", error);
        return NextResponse.json({ error: "Failed to extract branding" }, { status: 500 });
    }
}
