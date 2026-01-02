import { GoogleGenAI } from "@google/genai";
import type { PricingSchema, PricingDiffType } from "@/lib/types";
import type { DetectedDiff } from "./pricingDiff";

/**
 * Pricing Insights Generator
 *
 * Uses Gemini to generate "why it matters" explanations for detected pricing changes.
 * AI acts as EXPLAINER, not decision-maker. It interprets detected changes, not detects them.
 */

// ══════════════════════════════════════════════════════════════════════════════
// INSIGHT TYPES
// ══════════════════════════════════════════════════════════════════════════════

export interface PricingInsight {
    whyItMatters: string;
    strategicImplications: string;
    recommendedAction: string;
    tacticalPlaybook?: {
        salesDraft?: string;
        productPivot?: string;
        marketingAngle?: string;
    };
    confidence: "high" | "medium" | "low";
}

export interface InsightResult {
    success: true;
    insight: PricingInsight;
}

export interface InsightError {
    success: false;
    error: string;
}

export type InsightResponse = InsightResult | InsightError;

// ══════════════════════════════════════════════════════════════════════════════
// PROMPT TEMPLATES
// ══════════════════════════════════════════════════════════════════════════════

const INSIGHT_PROMPT = `You are a Tier-1 Competitive Intelligence Architect. Your goal is to provide MISSION-CRITICAL intelligence that helps a founder retain revenue.

DETECTED CHANGE:
{{CHANGE_DESCRIPTION}}

BEFORE STATE:
{{BEFORE_STATE}}

AFTER STATE:
{{AFTER_STATE}}

CHANGE TYPE: {{CHANGE_TYPE}}

CONTEXT:
- Company: {{COMPANY_NAME}}
- Region: {{REGION}}

INSTRUCTIONS:
1. Interpret the BUSINESS REALITY behind the change. 
2. Provide a "Tactical Playbook" with an actual SALES DRAFT or PRODUCT PIVOT.
3. If an competitor dropped prices, give a draft for an account manager to send to a lead who is comparing you.
4. If they added a feature, suggest a marketing angle to counter it.
5. Be ruthless, specific, and ROI-focused. Zero fluff.

Respond in JSON ONLY:
{
  "whyItMatters": "Concise executive summary of importance",
  "strategicImplications": "What they are signaling to the market",
  "recommendedAction": "High-level strategic recommendation",
  "tacticalPlaybook": {
    "salesDraft": "A ready-to-send email or script for sales teams (if applicable)",
    "productPivot": "Specific feature adjustment or roadmap priority (if applicable)",
    "marketingAngle": "How to frame this to Kunden/Social Media (if applicable)"
  },
  "confidence": "high|medium|low"
}

Return ONLY valid JSON.`;

const CHANGE_TYPE_CONTEXT: Record<PricingDiffType, string> = {
    price_increase: "Price increases often signal strong demand, increased costs, or market repositioning upward",
    price_decrease: "Price decreases may indicate competitive pressure, market share pursuit, or new efficiency gains",
    plan_added: "New plans often target new customer segments or address competitive gaps",
    plan_removed: "Removing plans simplifies offerings or indicates strategic retreat from certain segments",
    free_tier_removed: "Removing free tier is a significant monetization shift, often signals product-market fit confidence",
    free_tier_added: "Adding free tier indicates growth-focused strategy, potentially aggressive market expansion",
    plan_promoted: "Changing featured/recommended plan reveals which tier they want customers to choose",
    cta_changed: "CTA changes reflect conversion optimization efforts or sales strategy shifts",
    regional_difference: "Regional pricing differences indicate localized market strategies or purchasing power adjustments",
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN INSIGHT FUNCTION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Generate AI-powered insight for a detected pricing diff.
 */
export async function generatePricingInsight(
    diff: DetectedDiff,
    options?: {
        companyName?: string;
        region?: string;
        beforeScreenshot?: Buffer;
        afterScreenshot?: Buffer;
    }
): Promise<InsightResponse> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return {
            success: false,
            error: "GEMINI_API_KEY not configured",
        };
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

        // Build the prompt
        const prompt = INSIGHT_PROMPT
            .replace("{{CHANGE_DESCRIPTION}}", diff.description)
            .replace("{{BEFORE_STATE}}", diff.before || "N/A")
            .replace("{{AFTER_STATE}}", diff.after || "N/A")
            .replace("{{CHANGE_TYPE}}", `${diff.type} - ${CHANGE_TYPE_CONTEXT[diff.type]}`)
            .replace("{{COMPANY_NAME}}", options?.companyName || "Unknown")
            .replace("{{REGION}}", options?.region || "Global");

        const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
            { text: prompt },
        ];

        // Add screenshots if available (side-by-side context)
        if (options?.beforeScreenshot && options?.afterScreenshot) {
            parts.unshift(
                { text: "BEFORE SCREENSHOT:" },
                {
                    inlineData: {
                        mimeType: "image/jpeg",
                        data: options.beforeScreenshot.toString("base64"),
                    },
                },
                { text: "AFTER SCREENSHOT:" },
                {
                    inlineData: {
                        mimeType: "image/jpeg",
                        data: options.afterScreenshot.toString("base64"),
                    },
                }
            );
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{ role: "user", parts }],
            config: {
                maxOutputTokens: 500,
                temperature: 0.3,
            },
        });

        const rawText = response.text || "";

        if (!rawText) {
            return {
                success: false,
                error: "Gemini returned empty response",
            };
        }

        // Parse JSON response
        const cleanedText = rawText
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim();

        const parsed = JSON.parse(cleanedText) as PricingInsight;

        // Validate required fields
        if (!parsed.whyItMatters || !parsed.recommendedAction) {
            return {
                success: false,
                error: "Incomplete insight response from AI",
            };
        }

        return {
            success: true,
            insight: {
                whyItMatters: parsed.whyItMatters,
                strategicImplications: parsed.strategicImplications || "Strategy shift detected",
                recommendedAction: parsed.recommendedAction,
                tacticalPlaybook: parsed.tacticalPlaybook,
                confidence: parsed.confidence || "medium",
            },
        };
    } catch (error) {
        console.error("[PricingInsights] Error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// BATCH INSIGHT GENERATION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Generate insights for multiple diffs.
 * Batches to avoid rate limits.
 */
export async function generateBatchInsights(
    diffs: DetectedDiff[],
    options?: {
        companyName?: string;
        region?: string;
        maxInsights?: number;
    }
): Promise<Map<string, PricingInsight>> {
    const results = new Map<string, PricingInsight>();
    const maxInsights = options?.maxInsights || 3;

    // Only generate insights for top N diffs by severity
    const sortedDiffs = [...diffs]
        .sort((a, b) => b.severity - a.severity)
        .slice(0, maxInsights);

    // Process sequentially to respect rate limits
    for (const diff of sortedDiffs) {
        const result = await generatePricingInsight(diff, options);

        if (result.success) {
            const key = `${diff.type}-${diff.planName || "general"}`;
            results.set(key, result.insight);
        }

        // Small delay between calls
        await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return results;
}

// ══════════════════════════════════════════════════════════════════════════════
// FALLBACK INSIGHTS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Generate deterministic fallback insight when AI is unavailable.
 */
export function generateFallbackInsight(diff: DetectedDiff): PricingInsight {
    const templates: Record<PricingDiffType, PricingInsight> = {
        price_increase: {
            whyItMatters: "Price increases directly impact competitive positioning and may affect your relative value proposition.",
            strategicImplications: "Competitor may be signaling product maturity or strong demand.",
            recommendedAction: "Review your own pricing strategy and assess if adjustment is needed.",
            confidence: "high",
        },
        price_decrease: {
            whyItMatters: "Price decreases indicate competitive pressure or aggressive growth strategy.",
            strategicImplications: "Competitor may be pursuing market share or responding to new entrants.",
            recommendedAction: "Monitor customer churn and consider competitive response.",
            confidence: "high",
        },
        plan_added: {
            whyItMatters: "New plans often target underserved segments you may also want to address.",
            strategicImplications: "Competitor is expanding their addressable market.",
            recommendedAction: "Analyze the new plan to understand what gap they're filling.",
            confidence: "medium",
        },
        plan_removed: {
            whyItMatters: "Removing a plan simplifies their offering and may indicate strategic focus shift.",
            strategicImplications: "Competitor may be consolidating around core segments.",
            recommendedAction: "Check if displaced customers could be opportunities for you.",
            confidence: "medium",
        },
        free_tier_removed: {
            whyItMatters: "Removing free tier is a major monetization shift with significant user impact.",
            strategicImplications: "Competitor has reached product-market fit confidence.",
            recommendedAction: "Monitor for user migration opportunities and review your free tier strategy.",
            confidence: "high",
        },
        free_tier_added: {
            whyItMatters: "Adding free tier signals aggressive acquisition strategy.",
            strategicImplications: "Competitor may be entering growth mode or responding to freemium competitors.",
            recommendedAction: "Assess impact on your conversion funnel and consider response.",
            confidence: "high",
        },
        plan_promoted: {
            whyItMatters: "The highlighted plan reveals which tier they want customers to choose.",
            strategicImplications: "May indicate ARPU optimization efforts.",
            recommendedAction: "Compare your recommended plan positioning.",
            confidence: "medium",
        },
        cta_changed: {
            whyItMatters: "CTA changes reflect conversion optimization or sales strategy shifts.",
            strategicImplications: "May be A/B test winner or strategic pivot.",
            recommendedAction: "Monitor for pattern across multiple pages.",
            confidence: "low",
        },
        regional_difference: {
            whyItMatters: "Regional price differences indicate localized market strategies.",
            strategicImplications: "Competitor may have purchasing power or competitive situational pricing.",
            recommendedAction: "Review your own regional pricing strategy.",
            confidence: "medium",
        },
    };

    return templates[diff.type];
}
