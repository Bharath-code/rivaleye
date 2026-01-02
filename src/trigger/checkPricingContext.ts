import { task, logger, metadata } from "@trigger.dev/sdk/v3";
import { createClient } from "@supabase/supabase-js";
import type { PricingContext, PricingSnapshot, PricingDiff } from "@/lib/types";
import { scrapeWithGeoContext, closeGeoBrowser } from "@/lib/crawler/geoPlaywright";
import { decideScraper, getCurrencySymbols, shouldUpgradeToPlaywright } from "@/lib/crawler";
import { uploadScreenshot } from "@/lib/crawler/screenshotStorage";
import { diffPricing, type PricingDiffResult } from "@/lib/diff/pricingDiff";
import { generatePricingInsight, generateFallbackInsight } from "@/lib/diff/pricingInsights";
import { shouldTriggerAlert, formatAlertContent } from "@/lib/diff/alertRules";

/**
 * Check Pricing Context Task
 *
 * Child task that scrapes a specific competitor + pricing context combination.
 * Called by the daily analysis scheduler for each competitor-context pair.
 */

// ══════════════════════════════════════════════════════════════════════════════
// PAYLOAD & RESULT TYPES
// ══════════════════════════════════════════════════════════════════════════════

interface CheckPricingPayload {
    competitorId: string;
    competitorUrl: string;
    competitorName: string;
    userId: string;
    context: PricingContext;
    bestScraper?: "firecrawl" | "playwright" | null;
}

interface CheckPricingResult {
    success: boolean;
    snapshotId?: string;
    hasChanges: boolean;
    diffResult?: PricingDiffResult;
    alertCreated: boolean;
    error?: string;
}

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
// MAIN TASK
// ══════════════════════════════════════════════════════════════════════════════

export const checkPricingContext = task({
    id: "check-pricing-context",
    maxDuration: 120, // 2 minutes per context
    retry: {
        maxAttempts: 2,
        minTimeoutInMs: 5000,
    },
    run: async (payload: CheckPricingPayload): Promise<CheckPricingResult> => {
        const { competitorId, competitorUrl, competitorName, userId, context, bestScraper } = payload;

        logger.info("Starting pricing context check", {
            competitor: competitorName,
            context: context.key,
        });

        metadata.set("competitor", competitorName);
        metadata.set("context", context.key);
        metadata.set("step", "Initializing");

        const supabase = getSupabase();

        try {
            // Step 1: Get previous snapshot for this competitor + context
            metadata.set("step", "Fetching previous snapshot");
            const { data: prevSnapshots } = await supabase
                .from("pricing_snapshots")
                .select("*")
                .eq("competitor_id", competitorId)
                .eq("pricing_context_id", context.id)
                .order("taken_at", { ascending: false })
                .limit(1);

            const lastSnapshot = prevSnapshots?.[0] as PricingSnapshot | undefined;

            // Step 2: Decide which scraper to use
            const scraperType = decideScraper({
                context,
                lastSnapshot: lastSnapshot || null,
                competitorBestScraper: bestScraper,
            });

            logger.info(`Using scraper: ${scraperType}`, { reason: context.requires_browser ? "geo-context" : "fallback" });

            // Step 3: Fetch user plan and flags
            const { data: userRecord } = await supabase
                .from("users")
                .select("plan")
                .eq("id", userId)
                .single();

            const userPlan = (userRecord?.plan || "free") as "free" | "pro" | "enterprise";
            const { getFeatureFlags } = await import("@/lib/billing/featureFlags");
            const flags = getFeatureFlags(userPlan);

            // Step 4: Scrape with geo-context
            metadata.set("step", `Scraping with ${scraperType}`);

            let scrapeResult;
            if (scraperType === "playwright") {
                scrapeResult = await scrapeWithGeoContext(competitorUrl, context);
            } else {
                // Firecrawl fallback with upgrade check
                const { fetchPageWithFallback } = await import("@/lib/crawler");
                const firecrawlResult = await fetchPageWithFallback(competitorUrl);

                if (!firecrawlResult.success) {
                    // Fall back to Playwright
                    logger.info("Firecrawl failed, falling back to Playwright");
                    scrapeResult = await scrapeWithGeoContext(competitorUrl, context);
                } else {
                    // Check if we should upgrade to Playwright
                    const currencySymbols = getCurrencySymbols(context.key);
                    if (shouldUpgradeToPlaywright(firecrawlResult.markdown || "", currencySymbols)) {
                        logger.info("Upgrading to Playwright for better content");
                        scrapeResult = await scrapeWithGeoContext(competitorUrl, context);
                    } else {
                        // Use Firecrawl result
                        scrapeResult = await scrapeWithGeoContext(competitorUrl, context);
                    }
                }
            }

            if (!scrapeResult.success) {
                logger.error("Scrape failed", { error: scrapeResult.error });
                return {
                    success: false,
                    hasChanges: false,
                    alertCreated: false,
                    error: scrapeResult.error,
                };
            }

            // Step 5: Upload screenshot (PRO ONLY)
            metadata.set("step", "Uploading screenshot");
            let screenshotPath: string | null = null;

            if (flags.canViewScreenshots) {
                const uploadResult = await uploadScreenshot(
                    competitorId,
                    context.key,
                    scrapeResult.screenshot
                );

                if (uploadResult.success) {
                    screenshotPath = uploadResult.path;
                } else {
                    logger.warn("Screenshot upload failed", { error: uploadResult.error });
                }
            } else {
                logger.info("Skipping screenshot upload (Free plan)");
            }

            // Step 6: Store snapshot
            metadata.set("step", "Storing snapshot");
            const { data: newSnapshot, error: snapshotError } = await supabase
                .from("pricing_snapshots")
                .insert({
                    competitor_id: competitorId,
                    pricing_context_id: context.id,
                    source: scraperType,
                    currency_detected: scrapeResult.currencyDetected,
                    pricing_schema: scrapeResult.pricingSchema,
                    dom_hash: scrapeResult.domHash,
                    screenshot_path: screenshotPath,
                })
                .select()
                .single();

            if (snapshotError) {
                logger.error("Failed to store snapshot", { error: snapshotError });
                return {
                    success: false,
                    hasChanges: false,
                    alertCreated: false,
                    error: snapshotError.message,
                };
            }

            // Step 7: Diff pricing
            metadata.set("step", "Analyzing changes");
            const previousSchema = lastSnapshot?.pricing_schema || null;
            const diffResult = diffPricing(previousSchema, scrapeResult.pricingSchema);

            logger.info("Diff complete", {
                hasChanges: diffResult.hasMeaningfulChanges,
                diffCount: diffResult.diffs.length,
                severity: diffResult.overallSeverity,
            });

            let alertCreated = false;

            // Step 8: Create alerts if meaningful changes
            if (diffResult.hasMeaningfulChanges && diffResult.diffs.length > 0) {
                metadata.set("step", "Creating alerts");

                for (const diff of diffResult.diffs) {
                    const alertDecision = shouldTriggerAlert(diff);

                    if (alertDecision.shouldAlert) {
                        // Generate AI insight (PRO ONLY)
                        let aiExplanation: string | null = null;
                        let tacticalPlaybook: any = null;

                        if (flags.canViewAiInsights) {
                            const insightResult = await generatePricingInsight(diff, {
                                companyName: competitorName,
                                region: context.key.toUpperCase(),
                            });

                            if (insightResult.success) {
                                aiExplanation = insightResult.insight.whyItMatters;
                                tacticalPlaybook = insightResult.insight.tacticalPlaybook;
                            } else {
                                // Use fallback
                                const fallback = generateFallbackInsight(diff);
                                aiExplanation = fallback.whyItMatters;
                                tacticalPlaybook = fallback.tacticalPlaybook;
                            }
                        } else {
                            logger.info("Skipping AI insights (Free plan)");
                        }

                        // Store pricing diff
                        await supabase.from("pricing_diffs").insert({
                            competitor_id: competitorId,
                            pricing_context_id: context.id,
                            snapshot_before_id: lastSnapshot?.id || null,
                            snapshot_after_id: newSnapshot.id,
                            severity: diff.severity,
                            diff_type: diff.type,
                            diff: diff,
                            summary: diff.description,
                            ai_explanation: aiExplanation,
                            is_notified: false,
                        });

                        // Create alert in alerts table
                        const alertContent = formatAlertContent(diff, competitorName);

                        // Convert screenshot paths to public URLs for email
                        let screenshotUrl: string | null = null;
                        let previousScreenshotUrl: string | null = null;

                        if (screenshotPath) {
                            const { data: publicData } = supabase.storage
                                .from("screenshots")
                                .getPublicUrl(screenshotPath);
                            screenshotUrl = publicData?.publicUrl || null;
                        }

                        // Get previous snapshot's screenshot if available
                        if (lastSnapshot?.screenshot_path) {
                            const { data: prevPublicData } = supabase.storage
                                .from("screenshots")
                                .getPublicUrl(lastSnapshot.screenshot_path);
                            previousScreenshotUrl = prevPublicData?.publicUrl || null;
                        }

                        await supabase.from("alerts").insert({
                            user_id: userId,
                            competitor_id: competitorId,
                            type: diff.type,
                            severity: alertDecision.severity,
                            title: alertContent.headline,
                            description: alertContent.body,
                            details: {
                                context: context.key,
                                before: diff.before,
                                after: diff.after,
                                aiExplanation,
                                tacticalPlaybook,
                                screenshotPath,
                                screenshotUrl,
                                previousScreenshotUrl,
                            },
                        });

                        alertCreated = true;
                        logger.info("Alert created", {
                            type: diff.type,
                            severity: alertDecision.severity,
                        });
                    }
                }
            }

            // Step 8: Update competitor's best_scraper if proven
            if (scraperType) {
                await supabase
                    .from("competitors")
                    .update({
                        best_scraper: scraperType,
                        last_checked_at: new Date().toISOString(),
                        failure_count: 0,
                    })
                    .eq("id", competitorId);
            }

            metadata.set("step", "Complete");
            logger.info("Pricing context check complete", {
                snapshotId: newSnapshot.id,
                hasChanges: diffResult.hasMeaningfulChanges,
                alertCreated,
            });

            return {
                success: true,
                snapshotId: newSnapshot.id,
                hasChanges: diffResult.hasMeaningfulChanges,
                diffResult,
                alertCreated,
            };
        } catch (error) {
            logger.error("Unexpected error", { error });
            return {
                success: false,
                hasChanges: false,
                alertCreated: false,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        } finally {
            // Cleanup browser
            await closeGeoBrowser();
        }
    },
});
