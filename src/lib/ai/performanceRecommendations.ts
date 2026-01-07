import { GoogleGenAI } from "@google/genai";
import type { PSIResult, PSILighthouseAudit } from "@/lib/crawler/pageSpeedInsights";

/**
 * AI-Powered Performance Recommendations
 *
 * Uses Gemini to generate contextual, actionable recommendations
 * from PageSpeed Insights data.
 */

// ──────────────────────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────────────────────

export interface PerformanceRecommendation {
    priority: "high" | "medium" | "low";
    category: "speed" | "seo" | "accessibility" | "opportunity";
    issue: string;
    action: string;
    impact: string;
    competitiveAdvantage?: string;
}

export interface AIPerformanceAnalysis {
    summary: string;
    grade: string;
    recommendations: PerformanceRecommendation[];
    competitiveInsights: string[];
    quickWins: string[];
}

// ──────────────────────────────────────────────────────────────────────────────
// PROMPT
// ──────────────────────────────────────────────────────────────────────────────

function buildPerformancePrompt(psiData: PSIResult, competitorName: string): string {
    return `You are a web performance expert helping a SaaS founder understand their competitor's website performance.

COMPETITOR: ${competitorName}
URL: ${psiData.url}
PERFORMANCE SCORE: ${psiData.categories.performance}/100 (${getGradeLabel(psiData.categories.performance)})
ACCESSIBILITY SCORE: ${psiData.categories.accessibility}/100
SEO SCORE: ${psiData.categories.seo}/100

CORE WEB VITALS:
- LCP (Largest Contentful Paint): ${formatMetric(psiData.coreWebVitals.lcp, "ms")} ${getStatus(psiData.coreWebVitals.lcp, 2500, 4000)}
- FID (First Input Delay): ${formatMetric(psiData.coreWebVitals.fid, "ms")} ${getStatus(psiData.coreWebVitals.fid, 100, 300)}
- CLS (Cumulative Layout Shift): ${formatMetric(psiData.coreWebVitals.cls, "")} ${getStatus(psiData.coreWebVitals.cls, 0.1, 0.25)}
- TTFB (Time to First Byte): ${formatMetric(psiData.coreWebVitals.ttfb, "ms")} ${getStatus(psiData.coreWebVitals.ttfb, 800, 1800)}

TOP ISSUES:
${psiData.opportunities.map(o => `- ${o.title}: ${o.displayValue || "needs improvement"}`).join("\n")}

Analyze this competitor's performance and provide actionable insights for the user.

Return JSON in this exact format:
{
  "summary": "One sentence summary of competitor's performance",
  "grade": "A/B/C/D/F grade with brief justification",
  "recommendations": [
    {
      "priority": "high|medium|low",
      "category": "speed|seo|accessibility|opportunity",
      "issue": "What's wrong",
      "action": "What the USER should do to beat this competitor",
      "impact": "Expected improvement",
      "competitiveAdvantage": "How this helps beat the competitor"
    }
  ],
  "competitiveInsights": [
    "Key competitive insight 1",
    "Key competitive insight 2"
  ],
  "quickWins": [
    "If their LCP is slow, you can beat them by optimizing images",
    "Their accessibility is poor - you can capture users who need better UX"
  ]
}

Focus on:
1. What the competitor is doing POORLY (user's opportunity)
2. What the competitor is doing WELL (user should match or exceed)
3. Quick wins the user can exploit
4. SEO advantages if competitor has poor Core Web Vitals

Return ONLY valid JSON, no markdown blocks.`;
}

function getGradeLabel(score: number): string {
    if (score >= 90) return "Excellent";
    if (score >= 75) return "Good";
    if (score >= 50) return "Needs Work";
    if (score >= 25) return "Poor";
    return "Critical";
}

function formatMetric(value: number | null, unit: string): string {
    if (value === null) return "Not available";
    if (unit === "ms") return `${Math.round(value)}ms`;
    return value.toFixed(3);
}

function getStatus(value: number | null, good: number, poor: number): string {
    if (value === null) return "";
    if (value <= good) return "(Good ✓)";
    if (value <= poor) return "(Needs Improvement ⚠)";
    return "(Poor ✗)";
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN FUNCTION
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Generate AI-powered performance recommendations from PSI data.
 */
export async function generatePerformanceRecommendations(
    psiData: PSIResult,
    competitorName: string
): Promise<AIPerformanceAnalysis | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("[AI Recommendations] Missing GEMINI_API_KEY");
        return null;
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = buildPerformancePrompt(psiData, competitorName);

        console.log("[AI Recommendations] Starting analysis for", competitorName);

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                maxOutputTokens: 2000,
                temperature: 0.3, // Lower temperature for more consistent output
            },
        });

        const rawText = typeof response.text === "string"
            ? response.text
            : typeof (response as any).response?.text === "function"
                ? (response as any).response.text()
                : "";

        // Parse JSON from response
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error("[AI Recommendations] No JSON found in response. Text:", rawText);
            return null;
        }

        const analysis = JSON.parse(jsonMatch[0]) as AIPerformanceAnalysis;
        return analysis;
    } catch (error) {
        console.error("[AI Recommendations] Error:", error);
        return null;
    }
}

/**
 * Generate a simple text summary if AI fails.
 */
export function generateFallbackSummary(psiData: PSIResult): AIPerformanceAnalysis {
    const score = psiData.categories.performance;
    const recommendations: PerformanceRecommendation[] = [];

    // Generate recommendations based on PSI opportunities
    for (const opp of psiData.opportunities.slice(0, 3)) {
        recommendations.push({
            priority: opp.score !== null && opp.score < 0.5 ? "high" : "medium",
            category: "speed",
            issue: opp.title,
            action: (opp.description || "").split(".")[0] + ".",
            impact: opp.displayValue || "Improves load time",
        });
    }

    return {
        summary: `Competitor scores ${score}/100 on performance.`,
        grade: getGradeLabel(score),
        recommendations,
        competitiveInsights: [
            score < 50
                ? "Competitor has poor performance - opportunity to outperform them"
                : "Competitor has decent performance - match or exceed",
        ],
        quickWins: psiData.opportunities.slice(0, 2).map((o) => o.title),
    };
}
