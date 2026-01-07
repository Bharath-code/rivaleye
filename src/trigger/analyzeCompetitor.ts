import { task, logger, metadata } from "@trigger.dev/sdk/v3";
import { chromium } from "playwright";
import { createHash } from "crypto";

/**
 * On-Demand Competitor Analysis Task
 * 
 * Triggered from API for single competitor analysis with realtime progress.
 */

interface AnalyzePayload {
    competitorId: string;
    competitorUrl: string;
    competitorName: string;
    userId: string;
}

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

export const analyzeCompetitorTask = task({
    id: "analyze-competitor",
    maxDuration: 120, // 2 minutes
    run: async (payload: AnalyzePayload) => {
        const { competitorId, competitorUrl, competitorName, userId } = payload;

        logger.info("Starting analysis", { competitorName, competitorUrl });

        // Realtime progress
        metadata.set("status", "Initializing");
        metadata.set("progress", 0);
        metadata.set("competitorName", competitorName);

        const { createClient } = await import("@supabase/supabase-js");
        const { GoogleGenAI } = await import("@google/genai");

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Get previous analysis
        metadata.set("status", "Fetching previous analysis");
        metadata.set("progress", 10);

        const { data: prevAnalyses } = await supabase
            .from("analyses")
            .select("*")
            .eq("competitor_id", competitorId)
            .order("created_at", { ascending: false })
            .limit(1);

        const prevAnalysis = prevAnalyses?.[0];

        let browser;
        try {
            metadata.set("status", "Taking screenshot");
            metadata.set("progress", 20);

            browser = await chromium.launch({ headless: true });
            const page = await browser.newPage();

            await page.setViewportSize({ width: 1440, height: 900 });
            await page.goto(competitorUrl, { waitUntil: "networkidle", timeout: 30000 });
            await page.waitForTimeout(2000);
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 3));
            await page.waitForTimeout(1000);
            await page.evaluate(() => window.scrollTo(0, 0));

            const screenshot = await page.screenshot({ type: "jpeg", quality: 75, fullPage: true });
            await page.close();
            await browser.close();

            logger.info(`Screenshot captured: ${screenshot.length} bytes`);
            metadata.set("screenshotSize", screenshot.length);
            metadata.set("progress", 40);

            // AI Analysis
            metadata.set("status", "Analyzing with Gemini");

            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
            const base64Image = screenshot.toString("base64");

            const response = await ai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: [{
                    role: "user",
                    parts: [
                        { inlineData: { mimeType: "image/jpeg", data: base64Image } },
                        { text: `Analyze this competitor comprehensively. Return JSON: companyName, tagline, pricing {plans[]}, features {highlighted[], differentiators[]}, positioning {targetAudience, valueProposition, socialProof[]}, insights[], summary.` }
                    ]
                }],
                config: { maxOutputTokens: 4000, temperature: 0.2 },
            });

            metadata.set("progress", 70);

            const rawText = response.text || "";
            let analysis: CompetitorAnalysis;

            try {
                const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
                analysis = JSON.parse(cleaned);
            } catch {
                logger.error("Failed to parse AI response");
                return { success: false, error: "AI response parse failed" };
            }

            // Change detection
            metadata.set("status", "Detecting changes");
            metadata.set("progress", 80);

            const currentHash = hashAnalysis(analysis);
            const previousHash = prevAnalysis?.analysis_hash || null;
            const hasChanged = previousHash !== currentHash;

            // Store
            metadata.set("status", "Saving results");
            metadata.set("progress", 90);

            await supabase.from("analyses").insert({
                competitor_id: competitorId,
                user_id: userId,
                analysis_data: analysis,
                analysis_hash: currentHash,
                raw_analysis: rawText,
                screenshot_size: screenshot.length,
                model: "gemini-2.0-flash",
                has_changes: hasChanged,
            });

            // Update competitor
            await supabase
                .from("competitors")
                .update({ last_checked_at: new Date().toISOString(), failure_count: 0 })
                .eq("id", competitorId);

            // Final
            metadata.set("status", "Complete");
            metadata.set("progress", 100);
            metadata.set("hasChanged", hasChanged);

            logger.info("Analysis complete", { hasChanged, companyName: analysis.companyName });

            return {
                success: true,
                analysis,
                hasChanged,
                screenshotSize: screenshot.length,
            };
        } catch (error) {
            if (browser) await (browser as any).close();
            logger.error("Analysis failed", { error });
            metadata.set("status", "Failed");
            return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
    },
});
