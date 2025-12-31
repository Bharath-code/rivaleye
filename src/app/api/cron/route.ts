import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { captureAndAnalyze, type CompetitorAnalysis } from "@/lib/ai/visionAnalyzer";
import { sendAlertEmail } from "@/lib/alerts/sendEmail";
import type { Competitor } from "@/lib/types";
import { createHash } from "crypto";

/**
 * Daily Monitoring Cron Job (Vision-Based)
 *
 * Runs every 24 hours:
 * 1. Screenshot each competitor page
 * 2. Compress image
 * 3. Analyze with Gemini vision
 * 4. Compare hash with previous analysis
 * 5. If changed → create alert → send email
 * 6. Store analysis in database
 */

/**
 * Hash key analysis fields for change detection
 */
function hashAnalysis(analysis: CompetitorAnalysis): string {
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
 * Detect specific changes between analyses
 */
function detectChanges(
    previous: CompetitorAnalysis,
    current: CompetitorAnalysis
): { summary: string; details: string; changes: string[]; hasPricingChange: boolean } {
    const changes: string[] = [];
    let hasPricingChange = false;

    // Check pricing changes
    const prevPrices = previous.pricing?.plans?.map(p => `${p.name}:${p.price}`) || [];
    const currPrices = current.pricing?.plans?.map(p => `${p.name}:${p.price}`) || [];

    const priceChanges = currPrices.filter(p => !prevPrices.includes(p));
    if (priceChanges.length > 0) {
        changes.push(`Pricing: ${priceChanges.join(", ")}`);
        hasPricingChange = true;
    }

    // Check new features
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
        details: changes.join(". ") || "Minor content updates.",
        changes,
        hasPricingChange,
    };
}

export async function GET(request: NextRequest) {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const supabase = createServerClient();

        // Get all active competitors
        const { data: competitors, error: fetchError } = await supabase
            .from("competitors")
            .select("*, users(email)")
            .eq("is_active", true) as {
                data: (Competitor & { users: { email: string } })[] | null;
                error: Error | null;
            };

        if (fetchError || !competitors) {
            console.error("Error fetching competitors:", fetchError);
            return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
        }

        const results = {
            processed: 0,
            changed: 0,
            unchanged: 0,
            errors: 0,
        };

        for (const competitor of competitors) {
            try {
                console.log(`[Cron] Processing: ${competitor.name}`);

                // 1. Get previous analysis
                const { data: prevAnalyses } = await supabase
                    .from("analyses")
                    .select("*")
                    .eq("competitor_id", competitor.id)
                    .order("created_at", { ascending: false })
                    .limit(1);

                const prevAnalysis = prevAnalyses?.[0];

                // 2. Capture screenshot + analyze with Gemini
                const { analysis } = await captureAndAnalyze(competitor.url);

                if (!analysis.success) {
                    console.error(`[Cron] Analysis failed for ${competitor.name}:`, analysis.error);

                    // Update failure count
                    await supabase
                        .from("competitors")
                        .update({
                            failure_count: (competitor.failure_count || 0) + 1,
                            last_checked_at: new Date().toISOString(),
                        })
                        .eq("id", competitor.id);

                    results.errors++;
                    continue;
                }

                // 3. Hash for change detection
                const currentHash = hashAnalysis(analysis.analysis);
                const previousHash = prevAnalysis?.analysis_hash || null;
                const hasChanged = previousHash !== currentHash;

                // 4. Store analysis
                await supabase.from("analyses").insert({
                    competitor_id: competitor.id,
                    user_id: competitor.user_id,
                    analysis_data: analysis.analysis,
                    analysis_hash: currentHash,
                    raw_analysis: analysis.rawAnalysis,
                    screenshot_size: analysis.screenshotSize,
                    model: analysis.model,
                    has_changes: hasChanged,
                    created_at: analysis.timestamp,
                });

                // 5. If changed, create alert and send email
                if (hasChanged && prevAnalysis) {
                    const changeDetails = detectChanges(
                        prevAnalysis.analysis_data as CompetitorAnalysis,
                        analysis.analysis
                    );

                    // Create alert
                    await supabase.from("alerts").insert({
                        user_id: competitor.user_id,
                        competitor_id: competitor.id,
                        type: "vision_change",
                        severity: changeDetails.hasPricingChange ? "high" : "medium",
                        title: `${competitor.name}: ${changeDetails.summary}`,
                        description: changeDetails.details,
                        details: {
                            changes: changeDetails.changes,
                            insights: analysis.analysis.insights,
                        },
                    });

                    // Send email
                    const userEmail = competitor.users?.email;
                    if (userEmail) {
                        await sendAlertEmail({
                            to: userEmail,
                            competitorName: competitor.name,
                            pageUrl: competitor.url,
                            insight: {
                                whatChanged: changeDetails.details,
                                whyItMatters: analysis.analysis.summary || "Competitor made changes to their page.",
                                whatToDo: analysis.analysis.insights?.[0] || "Review the changes and assess impact on your strategy.",
                                confidence: changeDetails.hasPricingChange ? "high" : "medium",
                            },
                        });
                    }

                    results.changed++;
                    console.log(`[Cron] ✓ Change detected: ${competitor.name}`);
                } else {
                    results.unchanged++;
                    console.log(`[Cron] No change: ${competitor.name}`);
                }

                // 6. Update competitor
                await supabase
                    .from("competitors")
                    .update({
                        last_checked_at: new Date().toISOString(),
                        failure_count: 0,
                    })
                    .eq("id", competitor.id);

                results.processed++;

                // Rate limiting: wait between competitors
                await new Promise(r => setTimeout(r, 2000));
            } catch (error) {
                console.error(`[Cron] Error for ${competitor.name}:`, error);
                results.errors++;
            }
        }

        console.log("[Cron] Complete:", results);

        return NextResponse.json({
            success: true,
            ...results,
        });
    } catch (error) {
        console.error("[Cron] Job failed:", error);
        return NextResponse.json({ error: "Cron failed" }, { status: 500 });
    }
}

