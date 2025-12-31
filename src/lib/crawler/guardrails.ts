import type { Competitor } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Crawl Guardrails Module
 *
 * Enforces cost optimization rules:
 * - Page eligibility checks
 * - Failure backoff logic
 * - Daily crawl limits
 * - Hash deduplication
 */

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════

const MAX_FAILURES_BEFORE_PAUSE = 3;
const FAILURE_COOLDOWN_HOURS = 24;
const HASH_DEDUP_DAYS = 7;

// URL patterns eligible for crawling
const ELIGIBLE_URL_PATTERNS = ["/pricing", "/plans", "/features"];

// ══════════════════════════════════════════════════════════════════════════════
// ELIGIBILITY CHECK
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Determines if a competitor page should be crawled
 *
 * Returns false if:
 * - Status is not "active"
 * - Currently in failure cooldown
 * - Already checked today
 */
export function shouldCrawl(competitor: Competitor): { eligible: boolean; reason?: string } {
    // 1. Check status
    if (competitor.status !== "active") {
        return { eligible: false, reason: `Status is ${competitor.status}` };
    }

    // 2. Check failure cooldown
    if (competitor.failure_count >= MAX_FAILURES_BEFORE_PAUSE) {
        return { eligible: false, reason: "Paused due to repeated failures" };
    }

    if (competitor.last_failure_at) {
        const lastFailure = new Date(competitor.last_failure_at);
        const cooldownEnd = new Date(lastFailure.getTime() + FAILURE_COOLDOWN_HOURS * 60 * 60 * 1000);

        if (new Date() < cooldownEnd) {
            return { eligible: false, reason: "In failure cooldown period" };
        }
    }

    // 3. Check if already crawled today
    if (competitor.last_checked_at) {
        const lastChecked = new Date(competitor.last_checked_at);
        const today = new Date();

        if (
            lastChecked.getUTCFullYear() === today.getUTCFullYear() &&
            lastChecked.getUTCMonth() === today.getUTCMonth() &&
            lastChecked.getUTCDate() === today.getUTCDate()
        ) {
            return { eligible: false, reason: "Already checked today" };
        }
    }

    return { eligible: true };
}

/**
 * Checks if a URL is eligible for monitoring (pricing, plans, homepage)
 */
export function isEligibleUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        const path = parsed.pathname.toLowerCase();

        // Homepage is always eligible
        if (path === "/" || path === "") {
            return true;
        }

        // Check for eligible patterns
        return ELIGIBLE_URL_PATTERNS.some((pattern) => path.includes(pattern));
    } catch {
        return false;
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// SUCCESS / FAILURE TRACKING
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Records a successful crawl — resets failure count, updates last_checked_at
 */
export async function recordSuccess(
    supabase: SupabaseClient,
    competitorId: string
): Promise<void> {
    await supabase
        .from("competitors")
        .update({
            last_checked_at: new Date().toISOString(),
            failure_count: 0,
            last_failure_at: null,
        })
        .eq("id", competitorId);
}

/**
 * Records a failed crawl — increments failure count, pauses after threshold
 */
export async function recordFailure(
    supabase: SupabaseClient,
    competitorId: string,
    currentFailureCount: number
): Promise<{ paused: boolean }> {
    const newCount = currentFailureCount + 1;
    const shouldPause = newCount >= MAX_FAILURES_BEFORE_PAUSE;

    await supabase
        .from("competitors")
        .update({
            failure_count: newCount,
            last_failure_at: new Date().toISOString(),
            status: shouldPause ? "error" : undefined,
        })
        .eq("id", competitorId);

    return { paused: shouldPause };
}

// ══════════════════════════════════════════════════════════════════════════════
// HASH DEDUPLICATION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Checks if this hash was seen recently (within HASH_DEDUP_DAYS)
 * Used to prevent alerting on page reverts
 */
export async function isHashSeenRecently(
    supabase: SupabaseClient,
    competitorId: string,
    hash: string
): Promise<boolean> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - HASH_DEDUP_DAYS);

    const { data } = await supabase
        .from("snapshots")
        .select("id")
        .eq("competitor_id", competitorId)
        .eq("hash", hash)
        .gte("created_at", cutoffDate.toISOString())
        .limit(1);

    return (data?.length ?? 0) > 0;
}
