import { schedules, logger } from "@trigger.dev/sdk/v3";
import { createClient } from "@supabase/supabase-js";

/**
 * Daily AEO Change Detector
 *
 * Runs after aeoMonitorTask (5:30 AM UTC). For each user, checks
 * if any competitor's 7-day AEO visibility changed by ≥10% vs
 * the previous 7-day. If so, creates an alert.
 *
 * Why 10%: below this, changes are within noise (LLM answers vary
 * day-to-day). 10% is the threshold where a real change is happening.
 */

const MIN_CHANGE_PCT = 10;

export const aeoChangeDetector = schedules.task({
    id: "aeo-change-detector",
    cron: "30 5 * * *", // 5:30 AM UTC
    maxDuration: 60 * 10, // 10 min
    run: async () => {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // 1. Get all Pro users
        const { data: users } = await supabase
            .from("users")
            .select("id")
            .in("plan", ["pro", "enterprise"])
            .limit(500);

        if (!users) {
            return { success: true, alerts: 0 };
        }

        let totalAlerts = 0;

        for (const user of users) {
            // 2. Find changes (uses the RPC function from the migration)
            const { data: changes } = await supabase.rpc("detect_aeo_changes", {
                p_user_id: user.id,
                p_min_change_pct: MIN_CHANGE_PCT,
            });

            if (!changes || changes.length === 0) continue;

            // 3. Create one alert per change
            for (const change of changes) {
                const direction =
                    change.change_pct > 0 ? "gained visibility" : "lost visibility";
                const pct = Math.abs(change.change_pct);
                const emoji = change.change_pct > 0 ? "📈" : "📉";

                // Get the first competitor (to link to)
                const { data: firstAlert } = await supabase
                    .from("alerts")
                    .insert({
                        user_id: user.id,
                        competitor_id: change.competitor_id,
                        type: "aeo_visibility_change",
                        severity: pct >= 20 ? "high" : "medium",
                        title: `${emoji} ${change.competitor_name} ${direction} in AI answers (${pct.toFixed(1)}%)`,
                        description:
                            `${change.competitor_name} is now mentioned in ` +
                            `${change.current_pct}% of AI-generated answers (was ${change.previous_pct}%). ` +
                            `This is a ${pct >= 20 ? "major" : "meaningful"} shift in AI visibility.`,
                        details: {
                            aeo_change: {
                                current_pct: change.current_pct,
                                previous_pct: change.previous_pct,
                                change_pct: change.change_pct,
                            },
                        },
                    })
                    .select("id")
                    .single();

                if (firstAlert) {
                    totalAlerts++;
                    logger.info(
                        `AEO alert created: ${change.competitor_name} ${direction} ${pct.toFixed(1)}%`,
                        { alertId: firstAlert.id }
                    );
                }
            }
        }

        logger.info(`AEO change detector complete: ${totalAlerts} alerts created`);
        return { success: true, alerts: totalAlerts };
    },
});
