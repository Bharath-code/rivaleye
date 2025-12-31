// ══════════════════════════════════════════════════════════════════════════════
// RIVALEYE TYPES
// ══════════════════════════════════════════════════════════════════════════════

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
    created_at: string;
}
export interface Competitor {
    id: string;
    user_id: string;
    name: string;
    url: string;
    status: "active" | "paused" | "error";
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
    confidence: "high" | "medium" | "low";
}
