import { task, logger, metadata } from "@trigger.dev/sdk/v3";
import { captureScreenshot } from "@/lib/crawler/screenshot";
import { hashAnalysis } from "@/lib/crawler/hashAnalysis";
import type { CompetitorAnalysis } from "@/lib/ai/visionAnalyzer";

/**
 * Vision Analysis Context Task
 *
 * Child task: full-page vision analysis (positioning, features, tagline) for
 * one competitor. Triggered per-competitor by dailyPricingAnalysis (P4 merge —
 * was previously its own duplicate 6am cron in dailyAnalysis.ts).
 */

interface VisionAnalysisPayload {
    competitorId: string;
    competitorUrl: string;
    competitorName: string;
    userId: string;
}

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

export const visionAnalysisContext = task({
    id: "vision-analysis-context",
    maxDuration: 120,
    run: async (payload: VisionAnalysisPayload) => {
        const { competitorId, competitorUrl, competitorName, userId } = payload;

        logger.info("Starting vision analysis", { competitorName, competitorUrl });
        metadata.set("status", "Taking screenshot");

        const { createClient } = await import("@supabase/supabase-js");
        const { GoogleGenAI } = await import("@google/genai");

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        try {
            const { data: prevAnalyses } = await supabase
                .from("analyses")
                .select("*")
                .eq("competitor_id", competitorId)
                .order("created_at", { ascending: false })
                .limit(1);

            const prevAnalysis = prevAnalyses?.[0];

            const shot = await captureScreenshot(competitorUrl);
            if (!shot.success) {
                logger.error("Screenshot failed", { competitorName, error: shot.error });
                return { success: false, error: shot.error };
            }
            const screenshot = shot.screenshot;

            logger.info(`Screenshot: ${screenshot.length} bytes`);
            metadata.set("status", "Analyzing with AI");

            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
            const base64Image = screenshot.toString("base64");

            const response = await ai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: [{
                    role: "user",
                    parts: [
                        { inlineData: { mimeType: shot.contentType, data: base64Image } },
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
                logger.error("Parse failed", { competitorName });
                return { success: false, error: "AI response parse failed" };
            }

            metadata.set("status", "Detecting changes");
            const currentHash = hashAnalysis(analysis);
            const previousHash = prevAnalysis?.analysis_hash || null;
            const hasChanged = previousHash !== currentHash;

            let screenshotPath = null;
            try {
                const { uploadScreenshot } = await import("@/lib/crawler/screenshotStorage");
                const uploadResult = await uploadScreenshot(competitorId, "daily", screenshot);
                if (uploadResult.success) {
                    screenshotPath = uploadResult.path;
                }
            } catch (uploadErr) {
                logger.warn("R2 Upload failed during vision analysis", { error: uploadErr });
            }

            await supabase.from("analyses").insert({
                competitor_id: competitorId,
                user_id: userId,
                analysis_data: analysis,
                analysis_hash: currentHash,
                raw_analysis: rawText,
                screenshot_size: screenshot.length,
                screenshot_path: screenshotPath,
                model: "gemini-2.0-flash",
                has_changes: hasChanged,
            });

            if (hasChanged && prevAnalysis) {
                const changeDetails = detectChanges(
                    prevAnalysis.analysis_data as CompetitorAnalysis,
                    analysis
                );

                await supabase.from("alerts").insert({
                    user_id: userId,
                    competitor_id: competitorId,
                    type: "vision_change",
                    severity: changeDetails.hasPricingChange ? "high" : "medium",
                    title: `${competitorName}: ${changeDetails.summary}`,
                    description: changeDetails.details,
                    details: { changes: changeDetails.changes, insights: analysis.insights },
                });

                logger.info(`Change detected: ${competitorName}`);
            }

            metadata.set("status", "Complete");
            return { success: true, hasChanged, screenshotSize: screenshot.length };
        } catch (error) {
            logger.error("Vision analysis failed", { competitorName, error });
            metadata.set("status", "Failed");
            return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
    },
});
