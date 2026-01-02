import { task, logger, metadata } from "@trigger.dev/sdk/v3";
import { createClient } from "@supabase/supabase-js";
import {
    compareRegionalPricing,
    getLatestRegionalSnapshots,
    createRegionalDiffAlert,
} from "@/lib/diff/compareRegionalPricing";
import { getFeatureFlags } from "@/lib/billing/featureFlags";

/**
 * Cross-Region Pricing Comparison Task
 *
 * Compares pricing across different geographic regions for a competitor.
 * Detects hidden regional discounts and geo-pricing differences.
 * 
 * PRO USERS ONLY - Gated behind plan check.
 */

// ══════════════════════════════════════════════════════════════════════════════
// PAYLOAD & RESULT TYPES
// ══════════════════════════════════════════════════════════════════════════════

interface CrossRegionComparisonPayload {
    competitorId: string;
    competitorName: string;
    userId: string;
}

interface CrossRegionComparisonResult {
    success: boolean;
    hasRegionalDifferences: boolean;
    differencesCount: number;
    alertsCreated: number;
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

export const crossRegionComparison = task({
    id: "cross-region-comparison",
    maxDuration: 60, // 1 minute
    retry: {
        maxAttempts: 2,
        minTimeoutInMs: 3000,
    },
    run: async (payload: CrossRegionComparisonPayload): Promise<CrossRegionComparisonResult> => {
        const { competitorId, competitorName, userId } = payload;

        logger.info("Starting cross-region comparison", {
            competitor: competitorName,
            userId,
        });

        metadata.set("competitor", competitorName);
        metadata.set("step", "Initializing");

        const supabase = getSupabase();

        try {
            // Step 1: Check user plan (Pro only)
            metadata.set("step", "Checking user plan");
            const { data: userRecord } = await supabase
                .from("users")
                .select("plan")
                .eq("id", userId)
                .single();

            const userPlan = (userRecord?.plan || "free") as "free" | "pro" | "enterprise";
            const flags = getFeatureFlags(userPlan);

            if (!flags.maxRegions || flags.maxRegions < 2) {
                logger.info("Skipping cross-region comparison (Free plan)");
                return {
                    success: true,
                    hasRegionalDifferences: false,
                    differencesCount: 0,
                    alertsCreated: 0,
                    error: "Cross-region comparison requires Pro plan",
                };
            }

            // Step 2: Fetch snapshots from all regions
            metadata.set("step", "Fetching regional snapshots");
            const snapshots = await getLatestRegionalSnapshots(competitorId, supabase);

            if (snapshots.length < 2) {
                logger.info("Insufficient regions for comparison", {
                    regionsFound: snapshots.length,
                });
                return {
                    success: true,
                    hasRegionalDifferences: false,
                    differencesCount: 0,
                    alertsCreated: 0,
                };
            }

            logger.info("Comparing regional pricing", {
                regions: snapshots.map(s => s.region),
            });

            // Step 3: Compare regional pricing
            metadata.set("step", "Comparing prices across regions");
            const result = await compareRegionalPricing(snapshots);

            if (!result.hasRegionalDifferences) {
                logger.info("No significant regional differences found");
                return {
                    success: true,
                    hasRegionalDifferences: false,
                    differencesCount: 0,
                    alertsCreated: 0,
                };
            }

            // Step 4: Create alerts for each difference
            metadata.set("step", "Creating regional difference alerts");
            let alertsCreated = 0;

            for (const diff of result.differences) {
                const alertData = createRegionalDiffAlert(diff, competitorName);

                await supabase.from("alerts").insert({
                    user_id: userId,
                    competitor_id: competitorId,
                    type: "regional_difference",
                    severity: alertData.severity,
                    title: `${competitorName}: ${diff.isDiscount ? "Hidden Discount" : "Premium Pricing"} in ${diff.comparingRegion}`,
                    description: alertData.description,
                    details: {
                        planName: diff.planName,
                        baseRegion: diff.baseRegion,
                        basePrice: diff.basePrice,
                        comparingRegion: diff.comparingRegion,
                        comparingPrice: diff.comparingPrice,
                        percentDifference: diff.priceDifferencePercent,
                    },
                });

                alertsCreated++;
                logger.info("Regional difference alert created", {
                    plan: diff.planName,
                    difference: `${diff.priceDifferencePercent}%`,
                });
            }

            metadata.set("step", "Complete");
            logger.info("Cross-region comparison complete", {
                differencesFound: result.differences.length,
                alertsCreated,
                summary: result.summary,
            });

            return {
                success: true,
                hasRegionalDifferences: true,
                differencesCount: result.differences.length,
                alertsCreated,
            };
        } catch (error) {
            logger.error("Cross-region comparison failed", { error });
            return {
                success: false,
                hasRegionalDifferences: false,
                differencesCount: 0,
                alertsCreated: 0,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    },
});
