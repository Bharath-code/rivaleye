import { schedules, logger, metadata } from "@trigger.dev/sdk/v3";
import { chromium } from "playwright";
import { createHash } from "crypto";

/**
 * Daily Competitor Analysis Task with Realtime Progress
 *
 * Runs every day at 6:00 AM UTC.
 * Reports progress via metadata for realtime UI updates.
 */

// Types
interface PricingPlan {
    name: string;
    price: string;
    period?: string;
    credits?: string;
    features: string[];
}

interface CompetitorAnalysis {
    companyName: string;
    tagline?: string;
    pricing: {
        plans: PricingPlan[];
        billingOptions?: string[];
        currency?: string;
        promotions?: string[];
    };
    features: {
        highlighted: string[];
        differentiators: string[];
    };
    positioning: {
        targetAudience?: string;
        valueProposition?: string;
        socialProof?: string[];
    };
    insights: string[];
    summary: string;
}

// Hash for change detection
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

// Detect changes
function detectChanges(
    previous: CompetitorAnalysis,
    current: CompetitorAnalysis
): { summary: string; details: string; changes: string[]; hasPricingChange: boolean } {
    const changes: string[] = [];
    let hasPricingChange = false;

    const prevPrices = previous.pricing?.plans?.map(p => `${p.name}:${p.price}`) || [];
    const currPrices = current.pricing?.plans?.map(p => `${p.name}:${p.price}`) || [];

    const priceChanges = currPrices.filter(p => !prevPrices.includes(p));
    if (priceChanges.length > 0) {
        changes.push(`Pricing: ${priceChanges.join(", ")}`);
        hasPricingChange = true;
    }

    const prevFeatures = previous.features?.highlighted || [];
    const currFeatures = current.features?.highlighted || [];
    const newFeatures = currFeatures.filter(f => !prevFeatures.includes(f));
    if (newFeatures.length > 0) {
        changes.push(`New features: ${newFeatures.slice(0, 3).join(", ")}`);
    }

    if (previous.positioning?.valueProposition !== current.positioning?.valueProposition) {
        changes.push("Value proposition updated");
    }

    const summary = hasPricingChange
        ? "Pricing Change Detected"
        : changes.length > 0
            ? "Content Updated"
            : "Minor Changes";

    return { summary, details: changes.join(". ") || "Minor updates.", changes, hasPricingChange };
}

/**
 * Daily scheduled task with realtime progress
 */
export const dailyCompetitorAnalysis = schedules.task({
    id: "daily-competitor-analysis",
    cron: "0 6 * * *", // 6 AM UTC daily
    maxDuration: 300,
    run: async (payload) => {
        logger.info("Starting daily analysis", {
            scheduledAt: payload.timestamp,
            lastRun: payload.lastTimestamp
        });

        const { createClient } = await import("@supabase/supabase-js");
        const { GoogleGenAI } = await import("@google/genai");

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Get competitors
        const { data: competitors, error } = await supabase
            .from("competitors")
            .select("*, users(email)")
            .eq("is_active", true);

        if (error || !competitors?.length) {
            logger.error("No competitors found", { error });
            return { error: "No competitors" };
        }

        // Set initial progress metadata
        metadata.set("totalCompetitors", competitors.length);
        metadata.set("progress", 0);
        metadata.set("status", "Starting analysis...");

        const results = { processed: 0, changed: 0, unchanged: 0, errors: 0 };
        const browser = await chromium.launch({ headless: true });

        try {
            for (let i = 0; i < competitors.length; i++) {
                const competitor = competitors[i];
                const progress = Math.round(((i + 1) / competitors.length) * 100);

                // Update realtime progress
                metadata.set("progress", progress);
                metadata.set("status", `Analyzing ${competitor.name}...`);
                metadata.set("currentCompetitor", competitor.name);

                logger.info(`Processing ${i + 1}/${competitors.length}: ${competitor.name}`);

                try {
                    // Get previous analysis
                    const { data: prevAnalyses } = await supabase
                        .from("analyses")
                        .select("*")
                        .eq("competitor_id", competitor.id)
                        .order("created_at", { ascending: false })
                        .limit(1);

                    const prevAnalysis = prevAnalyses?.[0];

                    // Screenshot
                    metadata.set("step", "Taking screenshot");
                    const page = await browser.newPage();
                    await page.setViewportSize({ width: 1440, height: 900 });
                    await page.goto(competitor.url, { waitUntil: "networkidle", timeout: 30000 });
                    await page.waitForTimeout(2000);
                    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 3));
                    await page.waitForTimeout(1000);
                    await page.evaluate(() => window.scrollTo(0, 0));

                    const screenshot = await page.screenshot({ type: "jpeg", quality: 75, fullPage: true });
                    await page.close();

                    logger.info(`Screenshot: ${screenshot.length} bytes`);

                    // AI Analysis
                    metadata.set("step", "Analyzing with AI");
                    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
                    const base64Image = screenshot.toString("base64");

                    const response = await ai.models.generateContent({
                        model: "gemini-2.0-flash",
                        contents: [{
                            role: "user",
                            parts: [
                                { inlineData: { mimeType: "image/jpeg", data: base64Image } },
                                { text: `Analyze this competitor. Return JSON: companyName, tagline, pricing {plans[]}, features {highlighted[], differentiators[]}, positioning {targetAudience, valueProposition, socialProof[]}, insights[], summary.` }
                            ]
                        }],
                        config: { maxOutputTokens: 4000, temperature: 0.2 },
                    });

                    const rawText = response.text || "";
                    let analysis: CompetitorAnalysis;

                    try {
                        const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
                        analysis = JSON.parse(cleaned);
                    } catch {
                        logger.error(`Parse failed: ${competitor.name}`);
                        results.errors++;
                        continue;
                    }

                    // Change detection
                    metadata.set("step", "Detecting changes");
                    const currentHash = hashAnalysis(analysis);
                    const previousHash = prevAnalysis?.analysis_hash || null;
                    const hasChanged = previousHash !== currentHash;

                    // Store
                    await supabase.from("analyses").insert({
                        competitor_id: competitor.id,
                        user_id: competitor.user_id,
                        analysis_data: analysis,
                        analysis_hash: currentHash,
                        raw_analysis: rawText,
                        screenshot_size: screenshot.length,
                        model: "gemini-2.0-flash",
                        has_changes: hasChanged,
                    });

                    // Alert if changed
                    if (hasChanged && prevAnalysis) {
                        const changeDetails = detectChanges(
                            prevAnalysis.analysis_data as CompetitorAnalysis,
                            analysis
                        );

                        await supabase.from("alerts").insert({
                            user_id: competitor.user_id,
                            competitor_id: competitor.id,
                            type: "vision_change",
                            severity: changeDetails.hasPricingChange ? "high" : "medium",
                            title: `${competitor.name}: ${changeDetails.summary}`,
                            description: changeDetails.details,
                            details: { changes: changeDetails.changes, insights: analysis.insights },
                        });

                        results.changed++;
                        logger.info(`✓ Change detected: ${competitor.name}`);
                    } else {
                        results.unchanged++;
                    }

                    // Update competitor
                    await supabase
                        .from("competitors")
                        .update({ last_checked_at: new Date().toISOString(), failure_count: 0 })
                        .eq("id", competitor.id);

                    results.processed++;

                    // Rate limit
                    await new Promise(r => setTimeout(r, 2000));
                } catch (err) {
                    logger.error(`Error: ${competitor.name}`, { error: err });
                    results.errors++;
                }
            }
        } finally {
            await browser.close();
        }

        // Final status
        metadata.set("progress", 100);
        metadata.set("status", "Complete");
        metadata.set("results", results);

        logger.info("Daily analysis complete", results);
        return results;
    },
});
