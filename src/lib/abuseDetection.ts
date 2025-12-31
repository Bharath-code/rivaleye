import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Abuse Detection Heuristics
 *
 * Detects patterns, not intentions.
 * Protects system reliability without accusing users.
 */

// ══════════════════════════════════════════════════════════════════════════════
// ABUSE FLAGS
// ══════════════════════════════════════════════════════════════════════════════

export type AbuseFlag =
    | "manual_spam"
    | "page_hoarding"
    | "volatile_page"
    | "failure_loop"
    | "global_throttle";

export interface AbuseDetectionResult {
    flagged: boolean;
    flag?: AbuseFlag;
    message?: string;
    action?: "soft_block" | "warn" | "throttle" | "pause";
}

// ══════════════════════════════════════════════════════════════════════════════
// ABUSE CATEGORY 1: Manual Spam Detection
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Detect if user is spamming manual checks
 * Signal: Manual checks used at max every day for 3+ days
 */
export async function detectManualSpam(
    supabase: SupabaseClient,
    userId: string
): Promise<AbuseDetectionResult> {
    // Get last 7 days of quota history (if we track it)
    // For now, simplified check based on current state
    const { data: user } = await supabase
        .from("users")
        .select("manual_checks_today, plan")
        .eq("id", userId)
        .single();

    if (!user) return { flagged: false };

    const limit = user.plan === "free" ? 1 : 5;

    // If they've already hit max today, flag for monitoring
    if (user.manual_checks_today >= limit) {
        return {
            flagged: true,
            flag: "manual_spam",
            message: "Manual checks are temporarily limited to keep things reliable.",
            action: "soft_block",
        };
    }

    return { flagged: false };
}

// ══════════════════════════════════════════════════════════════════════════════
// ABUSE CATEGORY 2: Page Hoarding (Pro users)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Detect if Pro user is hoarding low-signal pages
 * Signal: >20 pages added in 24h with <1% alert rate
 */
export async function detectPageHoarding(
    supabase: SupabaseClient,
    userId: string
): Promise<AbuseDetectionResult> {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Count pages added in last 24h
    const { count: recentPages } = await supabase
        .from("competitors")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", twentyFourHoursAgo.toISOString());

    if ((recentPages ?? 0) > 20) {
        // Check alert rate
        const { count: alertCount } = await supabase
            .from("alerts")
            .select("*, competitors!inner(user_id)", { count: "exact", head: true })
            .eq("competitors.user_id", userId)
            .eq("is_meaningful", true);

        const { count: totalPages } = await supabase
            .from("competitors")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId);

        const alertRate = (alertCount ?? 0) / Math.max(totalPages ?? 1, 1);

        if (alertRate < 0.01) {
            return {
                flagged: true,
                flag: "page_hoarding",
                message: "We noticed many low-signal pages. Consider focusing on pricing or key pages.",
                action: "warn",
            };
        }
    }

    return { flagged: false };
}

// ══════════════════════════════════════════════════════════════════════════════
// ABUSE CATEGORY 3: Volatile Page Detection
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Detect if a page changes every crawl but is never meaningful
 * Signal: High change frequency + <2% meaningful rate
 */
export async function detectVolatilePage(
    supabase: SupabaseClient,
    competitorId: string
): Promise<AbuseDetectionResult> {
    // Get last 10 snapshots
    const { data: snapshots } = await supabase
        .from("snapshots")
        .select("hash, created_at")
        .eq("competitor_id", competitorId)
        .order("created_at", { ascending: false })
        .limit(10);

    if (!snapshots || snapshots.length < 5) {
        return { flagged: false };
    }

    // Count unique hashes (indicates changes)
    const uniqueHashes = new Set(snapshots.map((s) => s.hash)).size;
    const changeRate = uniqueHashes / snapshots.length;

    // Get meaningful alerts for this competitor
    const { count: meaningfulAlerts } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("competitor_id", competitorId)
        .eq("is_meaningful", true);

    const meaningfulRate = (meaningfulAlerts ?? 0) / Math.max(snapshots.length, 1);

    // High change rate but low meaningful rate = volatile
    if (changeRate > 0.7 && meaningfulRate < 0.02) {
        return {
            flagged: true,
            flag: "volatile_page",
            message: "This page changes frequently but rarely has meaningful updates.",
            action: "throttle",
        };
    }

    return { flagged: false };
}

// ══════════════════════════════════════════════════════════════════════════════
// ABUSE CATEGORY 4: Failure Loops (Already in guardrails.ts)
// ══════════════════════════════════════════════════════════════════════════════

// Handled by existing guardrails.ts recordFailure() function

// ══════════════════════════════════════════════════════════════════════════════
// ABUSE CATEGORY 5: Global Throttle (Kill Switch)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Check if global crawl limits are exceeded
 * Protects against bugs, loops, and unexpected spikes
 */
export async function checkGlobalThrottle(
    supabase: SupabaseClient,
    expectedDailyCrawls: number = 10000
): Promise<AbuseDetectionResult> {
    const today = new Date().toISOString().split("T")[0];

    // Count today's snapshots (proxy for crawls)
    const { count: todayCrawls } = await supabase
        .from("snapshots")
        .select("*", { count: "exact", head: true })
        .gte("created_at", `${today}T00:00:00Z`);

    const threshold = expectedDailyCrawls * 1.5;

    if ((todayCrawls ?? 0) > threshold) {
        return {
            flagged: true,
            flag: "global_throttle",
            message: "System temporarily throttled for reliability. Please try again later.",
            action: "throttle",
        };
    }

    return { flagged: false };
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPOSITE CHECK
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Run all relevant abuse checks for a user
 */
export async function runAbuseChecks(
    supabase: SupabaseClient,
    userId: string,
    competitorId?: string
): Promise<AbuseDetectionResult[]> {
    const results: AbuseDetectionResult[] = [];

    // User-level checks
    results.push(await detectManualSpam(supabase, userId));
    results.push(await detectPageHoarding(supabase, userId));

    // Competitor-level checks
    if (competitorId) {
        results.push(await detectVolatilePage(supabase, competitorId));
    }

    // Global checks
    results.push(await checkGlobalThrottle(supabase));

    return results.filter((r) => r.flagged);
}
