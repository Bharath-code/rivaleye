/**
 * Google PageSpeed Insights API Module
 *
 * Industry-standard performance metrics using Google's PSI API.
 * Returns Core Web Vitals, Lighthouse audits, and recommendations.
 *
 * API Limits: 25,000 requests/day (free)
 * Docs: https://developers.google.com/speed/docs/insights/v5/get-started
 */

// ──────────────────────────────────────────────────────────────────────────────
// TYPES (Based on Google PSI API response)
// ──────────────────────────────────────────────────────────────────────────────

export interface PSICoreWebVitals {
    lcp: number | null;           // Largest Contentful Paint (ms)
    fid: number | null;           // First Input Delay (ms)
    cls: number | null;           // Cumulative Layout Shift
    fcp: number | null;           // First Contentful Paint (ms)
    ttfb: number | null;          // Time to First Byte (ms)
    inp: number | null;           // Interaction to Next Paint (ms)
}

export interface PSILighthouseAudit {
    id: string;
    title: string;
    description: string;
    score: number | null;         // 0-1
    displayValue?: string;
    numericValue?: number;
}

export interface PSICategory {
    id: string;
    title: string;
    score: number;                // 0-1
}

export interface PSIResult {
    success: true;
    url: string;
    strategy: "mobile" | "desktop";
    coreWebVitals: PSICoreWebVitals;
    categories: {
        performance: number;      // 0-100
        accessibility: number;
        bestPractices: number;
        seo: number;
    };
    audits: PSILighthouseAudit[];
    opportunities: PSILighthouseAudit[];  // Improvement suggestions
    diagnostics: PSILighthouseAudit[];    // Detailed diagnostics
    fetchTime: string;
}

export interface PSIError {
    success: false;
    error: string;
    code: "API_ERROR" | "RATE_LIMITED" | "INVALID_URL" | "TIMEOUT" | "UNKNOWN";
}

export type PSIResponse = PSIResult | PSIError;

// ──────────────────────────────────────────────────────────────────────────────
// API CLIENT
// ──────────────────────────────────────────────────────────────────────────────

const PSI_API_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const TIMEOUT_MS = 60000; // PSI can take a while

/**
 * Fetch PageSpeed Insights for a URL.
 *
 * @param url - The URL to analyze
 * @param strategy - "mobile" or "desktop" (mobile is more strict)
 */
export async function getPageSpeedInsights(
    url: string,
    strategy: "mobile" | "desktop" = "mobile"
): Promise<PSIResponse> {
    const apiKey = process.env.GOOGLE_PSI_API_KEY;

    // PSI works without API key but with stricter rate limits
    // With key: 25,000/day, Without: 400/day
    const params = new URLSearchParams();
    params.append("url", url);
    params.append("strategy", strategy);
    params.append("category", "performance");
    params.append("category", "accessibility");
    params.append("category", "best-practices");
    params.append("category", "seo");

    if (apiKey) {
        params.append("key", apiKey);
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch(`${PSI_API_URL}?${params}`, {
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            if (response.status === 429) {
                return {
                    success: false,
                    error: "Rate limited by Google PSI API",
                    code: "RATE_LIMITED",
                };
            }

            if (response.status === 400) {
                return {
                    success: false,
                    error: errorData.error?.message || "Invalid URL",
                    code: "INVALID_URL",
                };
            }

            return {
                success: false,
                error: errorData.error?.message || `API error: ${response.status}`,
                code: "API_ERROR",
            };
        }

        const data = await response.json();
        return parsePageSpeedResponse(data, url, strategy);
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            return {
                success: false,
                error: "Request timed out after 60 seconds",
                code: "TIMEOUT",
            };
        }

        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            code: "UNKNOWN",
        };
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// RESPONSE PARSER
// ──────────────────────────────────────────────────────────────────────────────

function parsePageSpeedResponse(
    data: Record<string, unknown>,
    url: string,
    strategy: "mobile" | "desktop"
): PSIResult {
    const lighthouseResult = data.lighthouseResult as Record<string, unknown>;
    const loadingExperience = data.loadingExperience as Record<string, unknown>;

    // Extract Core Web Vitals from field data (real user data) or lab data
    const metrics = (loadingExperience?.metrics || {}) as Record<string, unknown>;
    const audits = (lighthouseResult?.audits || {}) as Record<string, unknown>;

    const coreWebVitals: PSICoreWebVitals = {
        lcp: extractMetricValue(metrics, "LARGEST_CONTENTFUL_PAINT_MS") ||
            extractAuditValue(audits, "largest-contentful-paint"),
        fid: extractMetricValue(metrics, "FIRST_INPUT_DELAY_MS"),
        cls: extractMetricValue(metrics, "CUMULATIVE_LAYOUT_SHIFT_SCORE") ||
            extractAuditValue(audits, "cumulative-layout-shift"),
        fcp: extractMetricValue(metrics, "FIRST_CONTENTFUL_PAINT_MS") ||
            extractAuditValue(audits, "first-contentful-paint"),
        ttfb: extractMetricValue(metrics, "EXPERIMENTAL_TIME_TO_FIRST_BYTE") ||
            extractAuditValue(audits, "server-response-time"),
        inp: extractMetricValue(metrics, "INTERACTION_TO_NEXT_PAINT"),
    };

    // Extract category scores
    const categories = (lighthouseResult?.categories || {}) as Record<string, unknown>;
    const categoryScores = {
        performance: extractCategoryScore(categories, "performance"),
        accessibility: extractCategoryScore(categories, "accessibility"),
        bestPractices: extractCategoryScore(categories, "best-practices"),
        seo: extractCategoryScore(categories, "seo"),
    };

    // Extract audits, opportunities, and diagnostics
    const allAudits = parseAudits(audits);
    const opportunities = allAudits.filter(
        (a) => a.score !== null && a.score < 1 && a.numericValue && a.numericValue > 0
    );
    const diagnostics = allAudits.filter(
        (a) => a.id.includes("diagnostic") || a.id.includes("bootup") || a.id.includes("mainthread")
    );

    return {
        success: true,
        url,
        strategy,
        coreWebVitals,
        categories: categoryScores,
        audits: allAudits.slice(0, 10), // Top 10 audits
        opportunities: opportunities.slice(0, 5),
        diagnostics: diagnostics.slice(0, 5),
        fetchTime: new Date().toISOString(),
    };
}

function extractMetricValue(
    metrics: Record<string, unknown>,
    key: string
): number | null {
    const metric = metrics[key] as Record<string, unknown> | undefined;
    if (!metric) return null;
    return (metric.percentile as number) || null;
}

function extractAuditValue(
    audits: Record<string, unknown>,
    key: string
): number | null {
    const audit = audits[key] as Record<string, unknown> | undefined;
    if (!audit) return null;
    return (audit.numericValue as number) || null;
}

function extractCategoryScore(
    categories: Record<string, unknown>,
    key: string
): number {
    const category = categories[key] as Record<string, unknown> | undefined;
    if (!category) return 0;
    return Math.round(((category.score as number) || 0) * 100);
}

function parseAudits(audits: Record<string, unknown>): PSILighthouseAudit[] {
    const result: PSILighthouseAudit[] = [];

    for (const [id, audit] of Object.entries(audits)) {
        if (!audit || typeof audit !== "object") continue;
        const a = audit as Record<string, unknown>;

        // Skip informational audits
        if (a.scoreDisplayMode === "informative" || a.scoreDisplayMode === "notApplicable") {
            continue;
        }

        result.push({
            id,
            title: (a.title as string) || id,
            description: (a.description as string) || "",
            score: a.score as number | null,
            displayValue: a.displayValue as string | undefined,
            numericValue: a.numericValue as number | undefined,
        });
    }

    // Sort by score (lowest first = most important to fix)
    return result.sort((a, b) => (a.score ?? 1) - (b.score ?? 1));
}

// ──────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Get performance grade from PSI score.
 */
export function getPerformanceGrade(score: number): "A" | "B" | "C" | "D" | "F" {
    if (score >= 90) return "A";
    if (score >= 75) return "B";
    if (score >= 50) return "C";
    if (score >= 25) return "D";
    return "F";
}

/**
 * Get Core Web Vitals status based on Google's thresholds.
 */
export function getCoreWebVitalsStatus(cwv: PSICoreWebVitals): {
    lcp: "good" | "needs-improvement" | "poor" | "unknown";
    fid: "good" | "needs-improvement" | "poor" | "unknown";
    cls: "good" | "needs-improvement" | "poor" | "unknown";
} {
    return {
        lcp: cwv.lcp === null ? "unknown" :
            cwv.lcp <= 2500 ? "good" :
                cwv.lcp <= 4000 ? "needs-improvement" : "poor",
        fid: cwv.fid === null ? "unknown" :
            cwv.fid <= 100 ? "good" :
                cwv.fid <= 300 ? "needs-improvement" : "poor",
        cls: cwv.cls === null ? "unknown" :
            cwv.cls <= 0.1 ? "good" :
                cwv.cls <= 0.25 ? "needs-improvement" : "poor",
    };
}

/**
 * Check if PSI API key is configured.
 */
export function isPSIKeyConfigured(): boolean {
    return !!process.env.GOOGLE_PSI_API_KEY;
}
