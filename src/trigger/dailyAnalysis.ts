import { schedules, logger, metadata } from "@trigger.dev/sdk/v3";
import { visionAnalysisContext } from "./visionAnalysisContext";

/**
 * Competitor Vision-Analysis Scheduler
 *
 * No default cron here — `dailyPricingAnalysis` is the sole 6am UTC entrypoint
 * (P4 merge) and already fires `visionAnalysisContext` once per competitor for
 * the free daily cadence. This task exists so `userSchedules.ts` can attach
 * PRO/ENTERPRISE cadences (every 6h / hourly) via `schedules.create()`, for
 * users who want vision analysis to run more often than daily.
 */
export const dailyCompetitorAnalysis = schedules.task({
    id: "daily-competitor-analysis",
    maxDuration: 300,
    run: async (payload) => {
        logger.info("Starting vision analysis scan", { scheduledAt: payload.timestamp });

        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: competitors, error } = await supabase
            .from("competitors")
            .select("id, url, name, user_id")
            .eq("is_active", true);

        if (error || !competitors?.length) {
            logger.error("No competitors found", { error });
            return { error: "No competitors", triggered: 0 };
        }

        metadata.set("totalCompetitors", competitors.length);

        let triggered = 0;
        for (const competitor of competitors) {
            try {
                await visionAnalysisContext.trigger({
                    competitorId: competitor.id,
                    competitorUrl: competitor.url,
                    competitorName: competitor.name,
                    userId: competitor.user_id,
                });
                triggered++;
            } catch (error) {
                logger.error("Failed to trigger vision analysis", { competitor: competitor.name, error });
            }
        }

        logger.info("Vision analysis scan complete", { triggered });
        return { triggered };
    },
});
