import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { captureAndAnalyze, type CompetitorAnalysis } from "@/lib/ai/visionAnalyzer";
import { createHash } from "crypto";
import { getUserWithQuota, canManualCheck, incrementManualCheckCount } from "@/lib/quotas";
import { detectManualSpam } from "@/lib/abuseDetection";
import { checkRateLimit, RATE_LIMITS, rateLimitHeaders } from "@/lib/rateLimit";

/**
 * Create a hash of the key analysis fields for change detection
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
 * POST /api/analyze-competitor
 *
 * Vision-based competitor analysis using Gemini.
 * This is the single entry point for manual scans (replaces deprecated /api/check-now).
 *
 * Guard order matters (cheap → expensive):
 *   1. Auth check (cookie presence + JWT validation)        — ~5ms
 *   2. Rate limit (in-memory sliding window)                 — ~1ms
 *   3. Body validation (competitorId present)                — ~1ms
 *   4. Ownership check (competitor belongs to user)         — ~50ms
 *   5. Quota + abuse check                                   — ~100ms
 *   6. Increment quota (atomic via RPC)                      — ~100ms
 *   7. Vision capture + Gemini call                          — ~30s, expensive
 *
 * Without step 4, a user could trigger analysis on someone else's
 * competitor id, burning the *target user's* quota budget. The fix
 * is to verify ownership BEFORE the quota check.
 */
export async function POST(request: Request) {
    try {
        // ── 1. Auth (must be first — don't burn budget on anon traffic) ──
        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // ── 2. Rate limit ──
        const rateCheck = checkRateLimit(`analysis:${userId}`, RATE_LIMITS.analysis);
        if (!rateCheck.allowed) {
            return NextResponse.json(
                { error: "Too many analysis requests. Please wait a few minutes." },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(Math.ceil(rateCheck.resetMs / 1000)),
                        ...rateLimitHeaders(rateCheck, RATE_LIMITS.analysis),
                    },
                }
            );
        }

        // ── 3. Body validation ──
        const body = await request.json();
        const { competitorId } = body;

        if (!competitorId || typeof competitorId !== "string") {
            return NextResponse.json(
                { error: "competitorId is required" },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        // ── 4. Ownership check (BEFORE quota — prevent quota drain attack) ──
        const { data: competitor, error: fetchError } = await supabase
            .from("competitors")
            .select("id, user_id, url, name, status, failure_count")
            .eq("id", competitorId)
            .eq("user_id", userId)
            .single();

        if (fetchError || !competitor) {
            return NextResponse.json(
                { error: "Competitor not found" },
                { status: 404 }
            );
        }

        if (competitor.status === "paused") {
            return NextResponse.json(
                { error: "This competitor is paused due to repeated failures. Check the URL and try again." },
                { status: 403 }
            );
        }

        // ── 5. Quota & abuse checks (now safe — we know it's the user's competitor) ──
        const user = await getUserWithQuota(supabase, userId);
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const abuseCheck = await detectManualSpam(supabase, userId);
        if (abuseCheck.flagged) {
            return NextResponse.json(
                { error: abuseCheck.message },
                { status: 429 }
            );
        }

        const quotaCheck = canManualCheck(user);
        if (!quotaCheck.allowed) {
            return NextResponse.json(
                {
                    error: quotaCheck.reason,
                    upgradePrompt: quotaCheck.upgradePrompt,
                },
                { status: 429 }
            );
        }

        // ── 6. Increment quota (atomic RPC) before the expensive call ──
        await incrementManualCheckCount(supabase, userId);

        // ── 7. Get previous analysis for comparison ──
        const { data: previousAnalyses } = await supabase
            .from("analyses")
            .select("*")
            .eq("competitor_id", competitorId)
            .order("created_at", { ascending: false })
            .limit(1);

        const previousAnalysis = previousAnalyses?.[0];

        console.log(`[Vision] Analyzing: ${competitor.url}`);

        // ── 8. Vision capture + Gemini (expensive) ──
        const { screenshot, analysis } = await captureAndAnalyze(competitor.url);

        if (!analysis.success) {
            return NextResponse.json(
                { error: analysis.error },
                { status: 500 }
            );
        }

        // Upload screenshot to Cloudflare R2
        let screenshotPath = null;
        if (screenshot) {
            const { uploadScreenshot } = await import("@/lib/crawler/screenshotStorage");
            const uploadResult = await uploadScreenshot(competitorId, "manual", screenshot);
            if (uploadResult.success) {
                screenshotPath = uploadResult.path;
            }
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
            screenshot_path: screenshotPath,
            model: analysis.model,
            has_changes: hasChanged,
            created_at: analysis.timestamp,
        };

        await supabase.from("analyses").insert(analysisRecord);

        // ── Save to pricing_snapshots for Market Radar ──
        let contextId: string | null = null;

        const { data: existingContext } = await supabase
            .from("pricing_contexts")
            .select("id")
            .eq("key", "global")
            .single();

        if (existingContext) {
            contextId = existingContext.id;
        } else {
            const { data: newContext } = await supabase
                .from("pricing_contexts")
                .insert({
                    key: "global",
                    country: null,
                    currency: "USD",
                    locale: "en-US",
                    timezone: "UTC",
                    requires_browser: true,
                })
                .select("id")
                .single();

            contextId = newContext?.id || null;
        }

        if (contextId && analysis.analysis.pricing?.plans?.length > 0) {
            const pricingSchema = {
                currency: analysis.analysis.pricing?.currency || "USD",
                plans: analysis.analysis.pricing.plans.map((p, idx) => ({
                    id: `plan-${idx}`,
                    name: p.name,
                    position: idx,
                    price_raw: p.price,
                    price_visible: !!p.price,
                    billing: p.period?.includes("year") ? "yearly" : "monthly",
                    cta: "",
                    badges: p.highlight ? [p.highlight] : [],
                    limits: {},
                    features: p.features || [],
                })),
                has_free_tier: analysis.analysis.pricing.plans.some(p =>
                    p.price?.toLowerCase().includes("free") || p.price === "$0"
                ),
                highlighted_plan: analysis.analysis.pricing.plans.find(p => p.highlight)?.name || null,
            };

            await supabase.from("pricing_snapshots").insert({
                competitor_id: competitorId,
                pricing_context_id: contextId,
                source: "playwright",
                currency_detected: pricingSchema.currency,
                pricing_schema: pricingSchema,
                dom_hash: currentHash,
                screenshot_path: screenshotPath,
                taken_at: analysis.timestamp,
            });

            console.log(`[Vision] Saved pricing snapshot for Market Radar`);
        }

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

        // Save screenshot to disk for debugging (development only, parametrized path)
        if (screenshot && process.env.NODE_ENV === "development") {
            const debugDir = process.env.DEBUG_SCREENSHOT_DIR ||
                `${process.cwd()}/.debug/rivaleye`;
            const fs = await import("fs/promises");
            const path = await import("path");
            await fs.mkdir(debugDir, { recursive: true });

            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            await fs.writeFile(
                path.join(debugDir, `screenshot_${timestamp}.png`),
                screenshot
            );
            await fs.writeFile(
                path.join(debugDir, `analysis_${timestamp}.json`),
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

        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes("429") || errorMessage.includes("quota")) {
            return NextResponse.json(
                {
                    error: "AI Rate Limit Reached. Gemini Free Tier limits input tokens. Please wait 1-2 minutes or use a smaller page.",
                    code: "RATE_LIMIT_EXCEEDED"
                },
                { status: 429 }
            );
        }

        return NextResponse.json(
            { error: errorMessage || "Analysis failed" },
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

    const prevPrices = previous.pricing?.plans?.map(p => `${p.name}:${p.price}`) || [];
    const currPrices = current.pricing?.plans?.map(p => `${p.name}:${p.price}`) || [];

    const priceChanges = currPrices.filter(p => !prevPrices.includes(p));
    if (priceChanges.length > 0) {
        changes.push(`Pricing updated: ${priceChanges.join(", ")}`);
        hasPricingChange = true;
    }

    const prevPlanNames = previous.pricing?.plans?.map(p => p.name) || [];
    const currPlanNames = current.pricing?.plans?.map(p => p.name) || [];
    const newPlans = currPlanNames.filter(n => !prevPlanNames.includes(n));
    if (newPlans.length > 0) {
        changes.push(`New plans: ${newPlans.join(", ")}`);
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

    return {
        summary,
        details: changes.join(". ") || "Minor content updates detected.",
        changes,
        hasPricingChange,
    };
}
