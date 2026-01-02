import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@/lib/types";

/**
 * Quota Management System
 *
 * Enforces per-user limits based on plan tier.
 * Protects Firecrawl + AI spend while keeping UX smooth.
 */

import { PLAN_LIMITS } from "./billing/featureFlags";

/**
 * Quota Management System
 *
 * Enforces per-user limits based on plan tier.
 * Protects Firecrawl + AI spend while keeping UX smooth.
 */

// Global safety limits
export const GLOBAL_LIMITS = {
    maxDailyCrawls: 100000, // Kill switch threshold
    crawlSpikeMultiplier: 1.5, // Trigger throttle if exceeds expected * this
};


// ══════════════════════════════════════════════════════════════════════════════
// QUOTA CHECKS
// ══════════════════════════════════════════════════════════════════════════════

export interface QuotaCheckResult {
    allowed: boolean;
    reason?: string;
    upgradePrompt?: boolean;
}

/**
 * Check if user can perform a scheduled crawl
 */
export function canScheduledCrawl(user: User): QuotaCheckResult {
    const limits = PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;
    const maxCrawls = (limits as any).scheduledCrawlsPerDay || 50; // Fallback for Pro

    if (user.crawls_today >= maxCrawls) {
        return {
            allowed: false,
            reason: "Daily crawl limit reached",
            upgradePrompt: user.plan === "free",
        };
    }

    return { allowed: true };
}

/**
 * Check if user can perform a manual "Check Now"
 */
export function canManualCheck(user: User): QuotaCheckResult {
    const limits = PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;
    // Note: featureFlags.ts needs manualChecksPerDay added to its interface
    const maxManual = (limits as any).manualChecksPerDay || (user.plan === "pro" ? 5 : 1);

    if (user.manual_checks_today >= maxManual) {
        return {
            allowed: false,
            reason: "You've reached today's manual check limit. We'll check again tomorrow.",
            upgradePrompt: user.plan === "free",
        };
    }

    return { allowed: true };
}

/**
 * Check if user can add another competitor page
 */
export async function canAddPage(
    supabase: SupabaseClient,
    userId: string,
    plan: "free" | "pro" | "enterprise"
): Promise<QuotaCheckResult> {
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

    const { count } = await supabase
        .from("competitors")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "active");

    const currentCount = count ?? 0;

    if (currentCount >= limits.maxCompetitors) {
        if (plan === "free") {
            return {
                allowed: false,
                reason: `Free plan limited to ${limits.maxCompetitors} competitor. Upgrade to Pro for more.`,
                upgradePrompt: true,
            };
        } else {
            return {
                allowed: false,
                reason: `You've reached the limit of ${limits.maxCompetitors} competitors on your plan. Contact us if you need more.`,
                upgradePrompt: false,
            };
        }
    }

    return { allowed: true };
}

// ══════════════════════════════════════════════════════════════════════════════
// QUOTA TRACKING
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Increment scheduled crawl count for user
 */
export async function incrementCrawlCount(
    supabase: SupabaseClient,
    userId: string
): Promise<void> {
    await ensureQuotaReset(supabase, userId);

    await supabase.rpc("increment_crawl_count", { user_id: userId });
}

/**
 * Increment manual check count for user
 */
export async function incrementManualCheckCount(
    supabase: SupabaseClient,
    userId: string
): Promise<void> {
    await ensureQuotaReset(supabase, userId);

    await supabase
        .from("users")
        .update({ manual_checks_today: supabase.rpc("increment", { x: 1 }) })
        .eq("id", userId);
}

/**
 * Reset quotas if it's a new day (UTC)
 */
async function ensureQuotaReset(
    supabase: SupabaseClient,
    userId: string
): Promise<void> {
    const { data: user } = await supabase
        .from("users")
        .select("last_quota_reset")
        .eq("id", userId)
        .single();

    if (!user) return;

    const lastReset = new Date(user.last_quota_reset);
    const now = new Date();

    // Check if last reset was before today (UTC)
    const lastResetDate = lastReset.toISOString().split("T")[0];
    const todayDate = now.toISOString().split("T")[0];

    if (lastResetDate !== todayDate) {
        await supabase
            .from("users")
            .update({
                crawls_today: 0,
                manual_checks_today: 0,
                last_quota_reset: now.toISOString(),
            })
            .eq("id", userId);
    }
}

/**
 * Get user with fresh quota state (resets if needed)
 */
export async function getUserWithQuota(
    supabase: SupabaseClient,
    userId: string
): Promise<User | null> {
    await ensureQuotaReset(supabase, userId);

    const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

    return data as User | null;
}
