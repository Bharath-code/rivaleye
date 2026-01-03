import { schedules, logger } from "@trigger.dev/sdk/v3";
import { createClient } from "@supabase/supabase-js";
import { PLAN_LIMITS } from "@/lib/billing/featureFlags";

/**
 * Data Retention Policy Task
 * 
 * Runs weekly to clean up old snapshots based on plan-specific retention limits.
 * - Free users: 7 days
 * - Pro/Enterprise users: Unlimited (Infinity)
 * 
 * This protects against unbounded database growth while respecting paid user data.
 */

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export const dataRetentionCleanup = schedules.task({
    id: "data-retention-cleanup",
    cron: {
        pattern: "0 3 * * 0", // 3 AM UTC every Sunday
        timezone: "UTC",
    },
    maxDuration: 300, // 5 minutes
    run: async () => {
        logger.info("Starting data retention cleanup");

        const supabase = getSupabase();

        // Get all users with their plans
        const { data: users, error: usersError } = await supabase
            .from("users")
            .select("id, plan");

        if (usersError || !users) {
            logger.error("Failed to fetch users", { error: usersError });
            return { error: "Failed to fetch users", deleted: 0 };
        }

        let totalDeleted = 0;
        const deletionDetails: { userId: string; plan: string; deleted: number }[] = [];

        for (const user of users) {
            const plan = (user.plan || "free") as keyof typeof PLAN_LIMITS;
            const retentionDays = PLAN_LIMITS[plan]?.alertHistoryDays ?? 7;

            // Skip users with unlimited retention
            if (retentionDays === Infinity) {
                continue;
            }

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

            // Get competitor IDs for this user
            const { data: competitors } = await supabase
                .from("competitors")
                .select("id")
                .eq("user_id", user.id);

            if (!competitors?.length) continue;

            const competitorIds = competitors.map(c => c.id);

            // Delete old snapshots
            const { count: snapshotCount } = await supabase
                .from("snapshots")
                .delete({ count: "exact" })
                .in("competitor_id", competitorIds)
                .lt("created_at", cutoffDate.toISOString());

            // Delete old alerts
            const { count: alertCount } = await supabase
                .from("alerts")
                .delete({ count: "exact" })
                .in("competitor_id", competitorIds)
                .lt("created_at", cutoffDate.toISOString());

            const userDeleted = (snapshotCount || 0) + (alertCount || 0);

            if (userDeleted > 0) {
                totalDeleted += userDeleted;
                deletionDetails.push({
                    userId: user.id,
                    plan,
                    deleted: userDeleted
                });
            }
        }

        logger.info("Data retention cleanup complete", {
            totalDeleted,
            usersAffected: deletionDetails.length,
            details: deletionDetails
        });

        return {
            success: true,
            totalDeleted,
            usersAffected: deletionDetails.length
        };
    },
});
