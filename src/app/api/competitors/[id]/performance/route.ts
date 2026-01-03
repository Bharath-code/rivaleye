import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { getFeatureFlags } from "@/lib/billing/featureFlags";
import {
    getPageSpeedInsights,
    getPerformanceGrade,
    getCoreWebVitalsStatus,
    type PSIResult,
} from "@/lib/crawler/pageSpeedInsights";
import {
    analyzePerformance,
    type PerformanceInsights,
} from "@/lib/crawler/performanceInsights";
import {
    generatePerformanceRecommendations,
    generateFallbackSummary,
    type AIPerformanceAnalysis,
} from "@/lib/ai/performanceRecommendations";
import {
    checkPerformanceChanges,
    createPerformanceAlerts,
    formatPerformanceAlertsForNotification,
} from "@/lib/alerts/performanceAlerts";

/**
 * Performance Insights API
 *
 * GET - Retrieve stored performance data for a competitor
 * POST - Trigger performance analysis (Pro feature)
 *
 * Strategy: Google PSI (primary) → Playwright (fallback)
 */

// Standardized response format
interface UnifiedPerformanceData {
    source: "google-psi" | "playwright";
    score: number;
    grade: "A" | "B" | "C" | "D" | "F";
    coreWebVitals: {
        lcp: { value: number | null; status: string };
        fid: { value: number | null; status: string };
        cls: { value: number | null; status: string };
    };
    categories: {
        performance: number;
        accessibility: number;
        bestPractices: number;
        seo: number;
    } | null;
    opportunities: Array<{
        title: string;
        description: string;
        impact: string;
    }>;
    fetchTime: string;
}

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

        // Get stored performance data
        const { data: performance } = await supabase
            .from("competitor_performance")
            .select("*")
            .eq("competitor_id", competitorId)
            .order("extracted_at", { ascending: false })
            .limit(1)
            .single();

        if (!performance) {
            return NextResponse.json({
                performance: null,
                message: "No performance data available. Trigger analysis with POST.",
            });
        }

        return NextResponse.json({
            performance: performance.insights,
            extractedAt: performance.extracted_at,
            competitorName: competitor.name,
        });
    } catch (error) {
        console.error("[Performance API] GET error:", error);
        return NextResponse.json({ error: "Failed to fetch performance data" }, { status: 500 });
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
                    error: "Performance insights is a Pro feature",
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

        // Try Google PSI first (industry standard)
        console.log(`[Performance API] Trying Google PSI for: ${competitor.url}`);
        let unifiedData: UnifiedPerformanceData | null = null;
        let psiResult: PSIResult | null = null;

        const psiResponse = await getPageSpeedInsights(competitor.url, "mobile");

        if (psiResponse.success) {
            psiResult = psiResponse;
            const cwvStatus = getCoreWebVitalsStatus(psiResponse.coreWebVitals);

            unifiedData = {
                source: "google-psi",
                score: psiResponse.categories.performance,
                grade: getPerformanceGrade(psiResponse.categories.performance),
                coreWebVitals: {
                    lcp: { value: psiResponse.coreWebVitals.lcp, status: cwvStatus.lcp },
                    fid: { value: psiResponse.coreWebVitals.fid, status: cwvStatus.fid },
                    cls: { value: psiResponse.coreWebVitals.cls, status: cwvStatus.cls },
                },
                categories: psiResponse.categories,
                opportunities: psiResponse.opportunities.map((o) => ({
                    title: o.title,
                    description: o.description,
                    impact: o.displayValue || "Check audit details",
                })),
                fetchTime: psiResponse.fetchTime,
            };
        } else {
            // Fallback to Playwright
            console.log(`[Performance API] PSI failed (${psiResponse.code}), falling back to Playwright`);
            const playwrightResult = await analyzePerformance(competitor.url);

            if (!playwrightResult.success) {
                return NextResponse.json(
                    { error: playwrightResult.error, code: playwrightResult.code },
                    { status: 422 }
                );
            }

            unifiedData = {
                source: "playwright",
                score: playwrightResult.insights.score.overall,
                grade: playwrightResult.insights.score.grade,
                coreWebVitals: {
                    lcp: {
                        value: playwrightResult.insights.coreWebVitals.lcp,
                        status: playwrightResult.insights.coreWebVitals.lcp === null ? "unknown" :
                            playwrightResult.insights.coreWebVitals.lcp <= 2500 ? "good" :
                                playwrightResult.insights.coreWebVitals.lcp <= 4000 ? "needs-improvement" : "poor",
                    },
                    fid: { value: null, status: "unknown" },
                    cls: {
                        value: playwrightResult.insights.coreWebVitals.cls,
                        status: playwrightResult.insights.coreWebVitals.cls === null ? "unknown" :
                            playwrightResult.insights.coreWebVitals.cls <= 0.1 ? "good" :
                                playwrightResult.insights.coreWebVitals.cls <= 0.25 ? "needs-improvement" : "poor",
                    },
                },
                categories: null,
                opportunities: playwrightResult.insights.score.issues.map((i) => ({
                    title: i.metric,
                    description: i.message,
                    impact: i.recommendation,
                })),
                fetchTime: playwrightResult.insights.extractedAt,
            };
        }

        // Get previous performance for comparison
        const { data: previousPerf } = await supabase
            .from("competitor_performance")
            .select("insights")
            .eq("competitor_id", competitorId)
            .order("extracted_at", { ascending: false })
            .limit(1)
            .single();

        // Compare with previous if exists and create alerts
        let diff = null;
        let alerts: ReturnType<typeof checkPerformanceChanges> = [];
        if (previousPerf?.insights) {
            const oldData = previousPerf.insights as UnifiedPerformanceData;
            const scoreDiff = unifiedData.score - oldData.score;

            diff = {
                scoreChange: scoreDiff,
                improved: scoreDiff > 5,
                degraded: scoreDiff < -5,
                summary: scoreDiff > 5
                    ? `Performance improved by ${scoreDiff} points`
                    : scoreDiff < -5
                        ? `Performance degraded by ${Math.abs(scoreDiff)} points — opportunity!`
                        : "Performance stable",
            };

            // Check for alerts
            alerts = checkPerformanceChanges(oldData, unifiedData);
            if (alerts.length > 0) {
                await createPerformanceAlerts(userId, competitorId, competitor.name, alerts);
                console.log(`[Performance API] Created ${alerts.length} performance alerts`);
            }
        }

        // Generate AI recommendations (if PSI data available)
        let aiAnalysis: AIPerformanceAnalysis | null = null;
        if (psiResult) {
            aiAnalysis = await generatePerformanceRecommendations(psiResult, competitor.name);
            if (!aiAnalysis) {
                aiAnalysis = generateFallbackSummary(psiResult);
            }
        }

        // Store new performance data
        const { error: insertError } = await supabase
            .from("competitor_performance")
            .insert({
                competitor_id: competitorId,
                insights: unifiedData,
                extracted_at: new Date().toISOString(),
            });

        if (insertError) {
            console.error("[Performance API] Insert error:", insertError);
        }

        return NextResponse.json({
            success: true,
            performance: unifiedData,
            psiRaw: psiResult, // Include raw PSI data for advanced users
            aiAnalysis,        // AI-generated recommendations
            diff,
            alerts: alerts.length > 0 ? alerts : null,
            competitorName: competitor.name,
        });
    } catch (error) {
        console.error("[Performance API] POST error:", error);
        return NextResponse.json({ error: "Failed to analyze performance" }, { status: 500 });
    }
}
