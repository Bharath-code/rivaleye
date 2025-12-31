import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { captureAndAnalyze, type CompetitorAnalysis } from "@/lib/ai/visionAnalyzer";
import { createHash } from "crypto";

/**
 * Create a hash of the key analysis fields for change detection
 */
function hashAnalysis(analysis: CompetitorAnalysis): string {
    // Hash only the fields that matter for change detection
    const keyData = {
        pricing: analysis.pricing?.plans?.map(p => ({
            name: p.name,
            price: p.price,
            credits: p.credits,
        })),
        features: analysis.features?.highlighted,
        positioning: analysis.positioning?.valueProposition,
    };

    return createHash("sha256")
        .update(JSON.stringify(keyData))
        .digest("hex");
}

/**
 * POST /api/analyze-competitor
 *
 * Screenshot-based competitor analysis using Gemini vision.
 * Captures a full-page screenshot and extracts comprehensive competitive intelligence.
 * Compares with previous analysis to detect changes.
 */
export async function POST(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { competitorId } = body;

        if (!competitorId) {
            return NextResponse.json(
                { error: "competitorId is required" },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        // Get competitor details
        const { data: competitor, error: fetchError } = await supabase
            .from("competitors")
            .select("*")
            .eq("id", competitorId)
            .eq("user_id", userId)
            .single();

        if (fetchError || !competitor) {
            return NextResponse.json(
                { error: "Competitor not found" },
                { status: 404 }
            );
        }

        // Get previous analysis for comparison
        const { data: previousAnalyses } = await supabase
            .from("analyses")
            .select("*")
            .eq("competitor_id", competitorId)
            .order("created_at", { ascending: false })
            .limit(1);

        const previousAnalysis = previousAnalyses?.[0];

        console.log(`[Vision] Analyzing: ${competitor.url}`);

        // Capture screenshot and analyze with Gemini
        const { screenshot, analysis } = await captureAndAnalyze(competitor.url);

        if (!analysis.success) {
            return NextResponse.json(
                { error: analysis.error },
                { status: 500 }
            );
        }

        // Hash current analysis for change detection
        const currentHash = hashAnalysis(analysis.analysis);
        const previousHash = previousAnalysis?.analysis_hash || null;
        const hasChanged = previousHash !== currentHash;

        // Store analysis in database
        const analysisRecord = {
            competitor_id: competitorId,
            user_id: userId,
            analysis_data: analysis.analysis,
            analysis_hash: currentHash,
            raw_analysis: analysis.rawAnalysis,
            screenshot_size: analysis.screenshotSize,
            model: analysis.model,
            has_changes: hasChanged,
            created_at: analysis.timestamp,
        };

        // Insert into analyses table
        await supabase.from("analyses").insert(analysisRecord);

        // If there are changes, create an alert
        if (hasChanged && previousAnalysis) {
            const changeDetails = detectSpecificChanges(
                previousAnalysis.analysis_data as CompetitorAnalysis,
                analysis.analysis
            );

            await supabase.from("alerts").insert({
                user_id: userId,
                competitor_id: competitorId,
                type: "vision_change",
                severity: changeDetails.hasPricingChange ? "high" : "medium",
                title: `${competitor.name}: ${changeDetails.summary}`,
                description: changeDetails.details,
                details: {
                    changes: changeDetails.changes,
                    previousHash,
                    currentHash,
                },
            });
        }

        // Save screenshot to disk for debugging (development only)
        if (screenshot && process.env.NODE_ENV === "development") {
            const fs = await import("fs/promises");
            const debugDir = "/Users/bharath/Desktop/SaaS_projects/rivaleye/debug";
            await fs.mkdir(debugDir, { recursive: true });

            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            await fs.writeFile(
                `${debugDir}/screenshot_${timestamp}.png`,
                screenshot
            );
            await fs.writeFile(
                `${debugDir}/analysis_${timestamp}.json`,
                JSON.stringify(analysis.analysis, null, 2)
            );
            console.log(`[Vision] Saved debug files to ${debugDir}`);
        }

        // Update competitor's last_checked_at
        await supabase
            .from("competitors")
            .update({ last_checked_at: new Date().toISOString() })
            .eq("id", competitorId);

        return NextResponse.json({
            success: true,
            competitorId,
            analysis: analysis.analysis,
            hasChanged,
            previousAnalysis: previousAnalysis?.analysis_data || null,
            analyzedAt: analysis.timestamp,
        });
    } catch (error) {
        console.error("[Vision API] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Analysis failed" },
            { status: 500 }
        );
    }
}

/**
 * Detect specific changes between two analyses
 */
function detectSpecificChanges(
    previous: CompetitorAnalysis,
    current: CompetitorAnalysis
): {
    summary: string;
    details: string;
    changes: string[];
    hasPricingChange: boolean;
} {
    const changes: string[] = [];
    let hasPricingChange = false;

    // Check pricing changes
    const prevPrices = previous.pricing?.plans?.map(p => `${p.name}:${p.price}`) || [];
    const currPrices = current.pricing?.plans?.map(p => `${p.name}:${p.price}`) || [];

    const priceChanges = currPrices.filter(p => !prevPrices.includes(p));
    if (priceChanges.length > 0) {
        changes.push(`Pricing updated: ${priceChanges.join(", ")}`);
        hasPricingChange = true;
    }

    // Check new plans added
    const prevPlanNames = previous.pricing?.plans?.map(p => p.name) || [];
    const currPlanNames = current.pricing?.plans?.map(p => p.name) || [];
    const newPlans = currPlanNames.filter(n => !prevPlanNames.includes(n));
    if (newPlans.length > 0) {
        changes.push(`New plans: ${newPlans.join(", ")}`);
    }

    // Check feature changes
    const prevFeatures = previous.features?.highlighted || [];
    const currFeatures = current.features?.highlighted || [];
    const newFeatures = currFeatures.filter(f => !prevFeatures.includes(f));
    if (newFeatures.length > 0) {
        changes.push(`New features: ${newFeatures.slice(0, 3).join(", ")}`);
    }

    // Check positioning changes
    if (previous.positioning?.valueProposition !== current.positioning?.valueProposition) {
        changes.push("Value proposition updated");
    }

    const summary = hasPricingChange
        ? "Pricing Change Detected"
        : changes.length > 0
            ? "Content Updated"
            : "Minor Changes";

    return {
        summary,
        details: changes.join(". ") || "Minor content updates detected.",
        changes,
        hasPricingChange,
    };
}

