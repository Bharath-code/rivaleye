/**
 * RivalEye Feature Flags & Plan Limits
 * 
 * Centralized logic for enforcing plan-based restrictions.
 */

export type UserPlan = "free" | "pro" | "enterprise";

export interface FeatureFlags {
    maxCompetitors: number;
    maxPagesPerCompetitor: number;
    canUseGeoAware: boolean;
    canViewAiInsights: boolean;
    canViewScreenshots: boolean;
    alertHistoryDays: number;
    checkFrequency: "daily" | "hourly";
    supportPriority: "normal" | "high";
    manualChecksPerDay: number;
    scheduledCrawlsPerDay: number;
    canViewGraphs: boolean;
    canViewRadar: boolean;
}

export const PLAN_LIMITS: Record<UserPlan, FeatureFlags> = {
    free: {
        maxCompetitors: 1,
        maxPagesPerCompetitor: 1,
        canUseGeoAware: false,
        canViewAiInsights: false,
        canViewScreenshots: false,
        alertHistoryDays: 7,
        checkFrequency: "daily",
        supportPriority: "normal",
        manualChecksPerDay: 1,
        scheduledCrawlsPerDay: 1,
        canViewGraphs: false,
        canViewRadar: false,
    },
    pro: {
        maxCompetitors: 5,
        maxPagesPerCompetitor: Infinity,
        canUseGeoAware: true,
        canViewAiInsights: true,
        canViewScreenshots: true,
        alertHistoryDays: Infinity,
        checkFrequency: "hourly",
        supportPriority: "high",
        manualChecksPerDay: 5,
        scheduledCrawlsPerDay: 50,
        canViewGraphs: true,
        canViewRadar: true,
    },
    enterprise: {
        maxCompetitors: 50,
        maxPagesPerCompetitor: Infinity,
        canUseGeoAware: true,
        canViewAiInsights: true,
        canViewScreenshots: true,
        alertHistoryDays: Infinity,
        checkFrequency: "hourly",
        supportPriority: "high",
        manualChecksPerDay: 50,
        scheduledCrawlsPerDay: 500,
        canViewGraphs: true,
        canViewRadar: true,
    },
};

/**
 * Get feature flags for a specific plan
 */
export function getFeatureFlags(plan: UserPlan = "free"): FeatureFlags {
    return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}

/**
 * Check if a user can perform an action based on their current usage and plan
 */
export function canPerformAction(
    action: keyof FeatureFlags | "addCompetitor",
    currentUsage: number,
    plan: UserPlan = "free"
): { allowed: boolean; reason?: string } {
    const flags = getFeatureFlags(plan);

    switch (action) {
        case "addCompetitor":
            if (currentUsage >= flags.maxCompetitors) {
                return {
                    allowed: false,
                    reason: `You've reached the limit of ${flags.maxCompetitors} competitor(s) on the ${plan} plan. Upgrade to Pro for more.`
                };
            }
            return { allowed: true };

        default:
            return { allowed: true };
    }
}
