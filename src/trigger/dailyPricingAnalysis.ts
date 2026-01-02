import { schedules, logger, metadata } from "@trigger.dev/sdk/v3";
import { createClient } from "@supabase/supabase-js";
import { checkPricingContext } from "./checkPricingContext";
import type { PricingContext, Competitor } from "@/lib/types";

/**
 * Daily Pricing Analysis Scheduler
 *
 * Geo-aware version of daily competitor analysis.
 * Loops through each competitor and their assigned pricing contexts.
 * 
 * Architecture:
 * - This task runs daily at 6 AM UTC
 * - For each competitor, it triggers checkPricingContext tasks for each context
 * - Implements frequency decay: reduce context checks after 30/90 days of no changes
 */

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
    // Context frequency decay rules
    frequencyDecay: {
        noChangeThreshold30Days: 0.5,  // Check every other day after 30 days no change
        noChangeThreshold90Days: 0.25, // Check weekly after 90 days no change
    },
    // Safety rails
    maxContextsPerCompetitor: 4,
    maxTotalContextChecks: 50, // Per run
    delayBetweenChecks: 3000, // 3 seconds
};

// ══════════════════════════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ══════════════════════════════════════════════════════════════════════════════

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN SCHEDULER
// ══════════════════════════════════════════════════════════════════════════════

export const dailyPricingAnalysis = schedules.task({
    id: "daily-pricing-analysis",
    cron: {
        pattern: "0 6 * * *", // 6 AM UTC daily
        timezone: "UTC",
    },
    maxDuration: 600, // 10 minutes
    run: async (payload) => {
        logger.info("Starting daily pricing analysis", {
            scheduledAt: payload.timestamp,
            lastRun: payload.lastTimestamp,
        });

        const supabase = getSupabase();

        // Step 1: Get all active competitors with user plans
        metadata.set("step", "Fetching competitors");
        const { data: competitors, error: competitorsError } = await supabase
            .from("competitors")
            .select(`
                *,
                users:user_id (plan)
            `)
            .eq("is_active", true);

        if (competitorsError || !competitors?.length) {
            logger.error("No active competitors", { error: competitorsError });
            return { error: "No competitors", processed: 0 };
        }

        // Step 2: Get all pricing contexts
        metadata.set("step", "Fetching pricing contexts");
        const { data: contexts, error: contextsError } = await supabase
            .from("pricing_contexts")
            .select("*");

        if (contextsError || !contexts?.length) {
            logger.error("No pricing contexts", { error: contextsError });
            return { error: "No contexts", processed: 0 };
        }

        const pricingContexts = contexts as PricingContext[];

        logger.info("Found data", {
            competitors: competitors.length,
            contexts: pricingContexts.length,
        });

        // Step 3: Build work queue
        metadata.set("step", "Building work queue");
        const workQueue = await buildWorkQueue(
            supabase,
            competitors as Competitor[],
            pricingContexts
        );

        logger.info("Work queue built", { totalChecks: workQueue.length });

        // Step 4: Set progress metadata
        metadata.set("totalChecks", workQueue.length);
        metadata.set("progress", 0);

        const results = {
            processed: 0,
            withChanges: 0,
            withAlerts: 0,
            errors: 0,
        };

        // Step 5: Process work queue
        for (let i = 0; i < workQueue.length; i++) {
            const work = workQueue[i];
            const progress = Math.round(((i + 1) / workQueue.length) * 100);

            metadata.set("progress", progress);
            metadata.set("current", `${work.competitorName} (${work.context.key})`);

            try {
                // Trigger the child task
                const result = await checkPricingContext.triggerAndWait({
                    competitorId: work.competitorId,
                    competitorUrl: work.competitorUrl,
                    competitorName: work.competitorName,
                    userId: work.userId,
                    context: work.context,
                    bestScraper: work.bestScraper,
                });

                if (result.ok) {
                    results.processed++;
                    if (result.output.hasChanges) results.withChanges++;
                    if (result.output.alertCreated) results.withAlerts++;
                } else {
                    results.errors++;
                    logger.error("Child task failed", {
                        competitor: work.competitorName,
                        context: work.context.key,
                        error: result.error,
                    });
                }
            } catch (error) {
                results.errors++;
                logger.error("Error processing context", {
                    competitor: work.competitorName,
                    context: work.context.key,
                    error,
                });
            }

            // Rate limiting between checks
            await new Promise((r) => setTimeout(r, CONFIG.delayBetweenChecks));
        }

        // Final status
        metadata.set("progress", 100);
        metadata.set("status", "Complete");
        metadata.set("results", results);

        logger.info("Daily pricing analysis complete", results);
        return results;
    },
});

// ══════════════════════════════════════════════════════════════════════════════
// WORK QUEUE BUILDER
// ══════════════════════════════════════════════════════════════════════════════

interface WorkItem {
    competitorId: string;
    competitorUrl: string;
    competitorName: string;
    userId: string;
    context: PricingContext;
    bestScraper: "firecrawl" | "playwright" | null;
}

async function buildWorkQueue(
    supabase: ReturnType<typeof getSupabase>,
    competitors: any[],
    contexts: PricingContext[]
): Promise<WorkItem[]> {
    const workQueue: WorkItem[] = [];
    const { getFeatureFlags } = await import("@/lib/billing/featureFlags");

    for (const competitor of competitors) {
        const userPlan = (competitor.users?.plan || "free") as "free" | "pro" | "enterprise";
        const flags = getFeatureFlags(userPlan);

        // Filter contexts: Free users only get "global" (or first context). Pro gets more.
        const allowedContexts = contexts.filter((c, idx) => {
            if (idx === 0) return true; // Always allow first context (e.g. global/default)
            return flags.canUseGeoAware;
        }).slice(0, flags.canUseGeoAware ? CONFIG.maxContextsPerCompetitor : 1);

        for (const context of allowedContexts) {
            // Apply frequency decay
            const shouldCheck = await shouldCheckContext(supabase, competitor.id, context.id);

            if (shouldCheck) {
                workQueue.push({
                    competitorId: competitor.id,
                    competitorUrl: competitor.url,
                    competitorName: competitor.name,
                    userId: competitor.user_id,
                    context,
                    bestScraper: (competitor.best_scraper as "firecrawl" | "playwright") || null,
                });
            }
        }

        // Safety rail: cap total checks
        if (workQueue.length >= CONFIG.maxTotalContextChecks) {
            logger.warn("Hit max context checks limit", { limit: CONFIG.maxTotalContextChecks });
            break;
        }
    }

    return workQueue;
}

// ══════════════════════════════════════════════════════════════════════════════
// FREQUENCY DECAY LOGIC
// ══════════════════════════════════════════════════════════════════════════════

async function shouldCheckContext(
    supabase: ReturnType<typeof getSupabase>,
    competitorId: string,
    contextId: string
): Promise<boolean> {
    // Get last meaningful diff for this competitor + context
    const { data: lastDiffs } = await supabase
        .from("pricing_diffs")
        .select("created_at")
        .eq("competitor_id", competitorId)
        .eq("pricing_context_id", contextId)
        .order("created_at", { ascending: false })
        .limit(1);

    if (!lastDiffs?.length) {
        // No previous diffs - always check
        return true;
    }

    const lastDiffDate = new Date((lastDiffs[0] as { created_at: string }).created_at);
    const daysSinceChange = (Date.now() - lastDiffDate.getTime()) / (1000 * 60 * 60 * 24);

    // Frequency decay based on days since last change
    if (daysSinceChange > 90) {
        // After 90 days: check 25% of the time (weekly effectively)
        return Math.random() < CONFIG.frequencyDecay.noChangeThreshold90Days;
    } else if (daysSinceChange > 30) {
        // After 30 days: check 50% of the time (every other day)
        return Math.random() < CONFIG.frequencyDecay.noChangeThreshold30Days;
    }

    // Within 30 days: always check
    return true;
}

// ══════════════════════════════════════════════════════════════════════════════
// ON-DEMAND TRIGGER
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Manually trigger pricing check for a specific competitor.
 * Use from API routes or dashboard.
 */
export async function triggerManualCheck(
    competitorId: string,
    contextKeys?: string[]
): Promise<{ triggered: number; contextKeys: string[] }> {
    const supabase = getSupabase();

    // Get competitor
    const { data: competitor, error: compError } = await supabase
        .from("competitors")
        .select("*")
        .eq("id", competitorId)
        .single();

    if (compError || !competitor) {
        throw new Error(`Competitor not found: ${competitorId}`);
    }

    // Get contexts
    const { data: contexts } = await supabase
        .from("pricing_contexts")
        .select("*");

    if (!contexts?.length) {
        throw new Error("No pricing contexts configured");
    }

    // Filter to requested contexts or use all
    const targetContexts = contextKeys
        ? contexts.filter((c: PricingContext) => contextKeys.includes(c.key))
        : contexts.slice(0, 4); // Default to first 4

    const triggeredKeys: string[] = [];

    for (const context of targetContexts as PricingContext[]) {
        await checkPricingContext.trigger({
            competitorId: competitor.id,
            competitorUrl: competitor.url,
            competitorName: competitor.name,
            userId: competitor.user_id,
            context,
            bestScraper: competitor.best_scraper as "firecrawl" | "playwright" | null,
        });
        triggeredKeys.push(context.key);
    }

    return {
        triggered: triggeredKeys.length,
        contextKeys: triggeredKeys,
    };
}
