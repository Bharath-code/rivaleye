// ══════════════════════════════════════════════════════════════════════════════
// RIVALEYE TYPES
// ══════════════════════════════════════════════════════════════════════════════

export interface UserSettings {
    email_enabled: boolean;
    digest_frequency: "instant" | "daily" | "weekly";
    slack_webhook_url: string | null;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
    email_enabled: true,
    digest_frequency: "instant",
    slack_webhook_url: null,
};

export interface User {
    id: string;
    email: string;
    plan: "free" | "pro";
    dodo_customer_id: string | null;
    dodo_subscription_id: string | null;
    subscription_status: "none" | "active" | "cancelled" | "past_due";
    // Quota tracking
    crawls_today: number;
    manual_checks_today: number;
    last_quota_reset: string;
    settings: UserSettings;
    created_at: string;
}
export interface Competitor {
    id: string;
    user_id: string;
    name: string;
    url: string;
    status: "active" | "paused" | "error";
    is_active: boolean;
    best_scraper: "firecrawl" | "playwright" | null;
    last_checked_at: string | null;
    failure_count: number;
    last_failure_at: string | null;
    created_at: string;
}

export interface Snapshot {
    id: string;
    competitor_id: string;
    hash: string;
    normalized_text: string;
    markdown: string | null;
    created_at: string;
}

export interface Alert {
    id: string;
    competitor_id: string;
    diff_summary: string;
    ai_insight: string;
    is_meaningful: boolean;
    created_at: string;
}

export interface CrawlResult {
    success: true;
    markdown: string;
    rawText: string;
}

export interface CrawlError {
    success: false;
    error: string;
    code: "TIMEOUT" | "BLOCKED" | "EMPTY" | "API_ERROR" | "UNKNOWN";
}

export type CrawlResponse = CrawlResult | CrawlError;

export interface DiffResult {
    hasChanges: boolean;
    changedBlocks: {
        oldText: string;
        newText: string;
    }[];
}

export interface MeaningfulnessResult {
    isMeaningful: boolean;
    reason: string;
    signalType?: "pricing" | "feature" | "cta" | "positioning" | "plan";
}

export interface AIInsight {
    whatChanged: string;
    whyItMatters: string;
    whatToDo: string;
    tacticalPlaybook?: {
        salesDraft?: string;
        productPivot?: string;
        marketingAngle?: string;
    };
    confidence: "high" | "medium" | "low";
}

// ══════════════════════════════════════════════════════════════════════════════
// GEO-AWARE PRICING TYPES
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Pricing context configuration for geo-aware scraping.
 * Each context simulates a visitor from a specific region.
 */
export interface PricingContext {
    id: string;
    key: "us" | "in" | "eu" | "global";
    country: string | null;
    currency: string | null;
    locale: string;
    timezone: string;
    requires_browser: boolean;
    created_at: string;
}

/**
 * Structured pricing plan extracted from competitor page.
 * Survives obfuscation, animation, and A/B tests.
 */
export interface PricingPlan {
    id: string;
    name: string;
    position: number;
    price_raw: string | null;
    price_visible: boolean;
    billing: "monthly" | "yearly" | "one-time" | "unknown";
    cta: string;
    badges: string[];
    limits: Record<string, string>;
    features: string[];
}

/**
 * Structured pricing schema for diffing.
 * This is what we compare between snapshots.
 */
export interface PricingSchema {
    currency: string;
    plans: PricingPlan[];
    has_free_tier: boolean;
    highlighted_plan: string | null;
}

/**
 * Pricing snapshot for a specific competitor + context.
 */
export interface PricingSnapshot {
    id: string;
    competitor_id: string;
    pricing_context_id: string;
    source: "firecrawl" | "playwright";
    currency_detected: string | null;
    pricing_schema: PricingSchema;
    dom_hash: string;
    screenshot_path: string | null;
    taken_at: string;
}

/**
 * Types of pricing changes we alert on.
 * Each type has different severity implications.
 */
export type PricingDiffType =
    | "price_increase"
    | "price_decrease"
    | "plan_added"
    | "plan_removed"
    | "free_tier_removed"
    | "free_tier_added"
    | "plan_promoted"
    | "cta_changed"
    | "regional_difference";

/**
 * Pricing diff result with severity scoring.
 * Only meaningful diffs are stored and alerted.
 */
export interface PricingDiff {
    id: string;
    competitor_id: string;
    pricing_context_id: string;
    snapshot_before_id: string | null;
    snapshot_after_id: string;
    severity: number; // 0-1
    diff_type: PricingDiffType;
    diff: object;
    summary: string;
    ai_explanation: string | null;
    is_notified: boolean;
    created_at: string;
}

/**
 * Severity levels for alert display.
 */
export type AlertSeverity = "high" | "medium" | "low";

/**
 * Map diff types to severity levels.
 */
export const DIFF_TYPE_SEVERITY: Record<PricingDiffType, AlertSeverity> = {
    price_increase: "high",
    price_decrease: "high",
    plan_added: "high",
    plan_removed: "high",
    free_tier_removed: "high",
    free_tier_added: "high",
    plan_promoted: "medium",
    cta_changed: "medium",
    regional_difference: "medium",
};

