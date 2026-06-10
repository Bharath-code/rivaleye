import { schedules, logger, metadata } from "@trigger.dev/sdk/v3";
import { createClient } from "@supabase/supabase-js";
import { runAEOScan } from "@/lib/aeo/scan";

/**
 * Daily AEO Monitor Cron
 *
 * Runs every day at 5:00 AM UTC (1h before the pricing crawl at 6:00 AM).
 * For every active competitor, runs an AEO scan using the user's stored
 * queries. Results are written to aeo_visibility.
 *
 * Cost: 5 queries × 5 models × 1 competitor × N users.
 * At 1000 Pro users with 5 competitors each = 25K queries/day.
 * With Gemini Flash as the dominant cost ($0.00002/query): ~$0.50/day
 * With GPT-4o-mini and Haiku mixed in: ~$5/day
 * At 1K users: ~$150/month. Manageable, scales linearly.
 *
 * Optimization: We batch by user (run all competitors for user X
 * before moving to user Y) to maximize connection reuse.
 */

export const aeoMonitorTask = schedules.task({
    id: "aeo-monitor",
    cron: "0 5 * * *", // 5 AM UTC daily
    maxDuration: 60 * 30, // 30 min cap (we have lots of users)
    run: async (payload, { ctx }) => {
        logger.info("AEO monitor cron started", { ts: payload.timestamp });

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // 1. Get all Pro users (AEO is a Pro feature for now)
        //    Free users: 1 scan per week max (we'll handle quota later)
        const { data: proUsers, error: userError } = await supabase
            .from("users")
            .select("id, plan")
            .in("plan", ["pro", "enterprise"])
            .limit(500); // safety cap

        if (userError) {
            logger.error("Failed to fetch Pro users", { err: userError });
            return { success: false, error: userError.message };
        }

        logger.info(`AEO scan: ${proUsers?.length || 0} Pro users`);

        let totalScans = 0;
        let totalCost = 0;
        let totalErrors = 0;

        for (const user of proUsers || []) {
            // 2. Get user's active competitors with AEO enabled
            const { data: competitors } = await supabase
                .from("competitors")
                .select("id, name")
                .eq("user_id", user.id)
                .eq("status", "active")
                .eq("aeo_enabled", true)
                .limit(10);

            if (!competitors || competitors.length === 0) continue;

            for (const comp of competitors) {
                metadata.set(`Scanning ${comp.name}`, { userId: user.id, competitorId: comp.id });

                try {
                    const result = await runAEOScan(user.id, comp.id, {});
                    totalScans++;
                    totalCost += result.cost_usd;
                    if (result.errors.length > 0) {
                        totalErrors += result.errors.length;
                    }
                } catch (err) {
                    logger.error(
                        `AEO scan failed for ${user.id}/${comp.id}`,
                        { err }
                    );
                    totalErrors++;
                }

                // Yield to other tasks (don't hog the Trigger.dev worker)
                await new Promise((r) => setTimeout(r, 100));
            }
        }

        logger.info("AEO monitor cron complete", {
            scans: totalScans,
            cost: totalCost,
            errors: totalErrors,
        });

        return {
            success: true,
            scans: totalScans,
            cost_usd: totalCost,
            errors: totalErrors,
        };
    },
});
