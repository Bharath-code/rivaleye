import { schedules, logger } from "@trigger.dev/sdk/v3";
import { dailyCompetitorAnalysis } from "./dailyAnalysis";

/**
 * Per-User Schedule Management
 *
 * Allows different users to have different check frequencies:
 * - Free: 1x per day
 * - Pro: 4x per day
 * - Enterprise: Hourly
 */

export type PlanType = "free" | "pro" | "enterprise";

const PLAN_CRON: Record<PlanType, string> = {
    free: "0 6 * * *",       // Daily at 6 AM UTC
    pro: "0 */6 * * *",      // Every 6 hours
    enterprise: "0 * * * *", // Hourly
};

const PLAN_TIMEZONE: Record<string, string> = {
    "us-east": "America/New_York",
    "us-west": "America/Los_Angeles",
    "eu": "Europe/London",
    "asia": "Asia/Tokyo",
    "default": "UTC",
};

/**
 * Create or update a user's schedule
 */
export async function createUserSchedule(
    userId: string,
    plan: PlanType,
    timezone?: string
): Promise<{ scheduleId: string; cron: string }> {
    const cron = PLAN_CRON[plan];
    const tz = timezone ? PLAN_TIMEZONE[timezone] || timezone : "UTC";

    logger.info("Creating user schedule", { userId, plan, cron, timezone: tz });

    const schedule = await schedules.create({
        task: dailyCompetitorAnalysis.id,
        cron,
        timezone: tz,
        externalId: userId,
        // Prevents duplicate schedules per user
        deduplicationKey: `${userId}-competitor-analysis`,
    });

    return {
        scheduleId: schedule.id,
        cron,
    };
}

/**
 * Update a user's schedule (e.g., on plan upgrade)
 */
export async function updateUserSchedule(
    userId: string,
    newPlan: PlanType,
    timezone?: string
): Promise<{ scheduleId: string; cron: string }> {
    // Simply create with same deduplicationKey - it will update
    return createUserSchedule(userId, newPlan, timezone);
}

/**
 * Deactivate a user's schedule (e.g., on subscription cancel)
 */
export async function deactivateUserSchedule(
    scheduleId: string
): Promise<boolean> {
    try {
        await schedules.deactivate(scheduleId);
        logger.info("Schedule deactivated", { scheduleId });
        return true;
    } catch (error) {
        logger.error("Failed to deactivate schedule", { scheduleId, error });
        return false;
    }
}

/**
 * Reactivate a user's schedule
 */
export async function activateUserSchedule(
    scheduleId: string
): Promise<boolean> {
    try {
        await schedules.activate(scheduleId);
        logger.info("Schedule activated", { scheduleId });
        return true;
    } catch (error) {
        logger.error("Failed to activate schedule", { scheduleId, error });
        return false;
    }
}

/**
 * Delete a user's schedule
 */
export async function deleteUserSchedule(
    scheduleId: string
): Promise<boolean> {
    try {
        await schedules.del(scheduleId);
        logger.info("Schedule deleted", { scheduleId });
        return true;
    } catch (error) {
        logger.error("Failed to delete schedule", { scheduleId, error });
        return false;
    }
}

/**
 * List all schedules for debugging
 */
export async function listAllSchedules() {
    return schedules.list();
}

/**
 * Get available timezones
 */
export async function getTimezones() {
    return schedules.timezones();
}
