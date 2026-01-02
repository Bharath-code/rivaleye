import type { PricingDiffType, AlertSeverity } from "@/lib/types";
import type { DetectedDiff } from "./pricingDiff";

/**
 * Alert Rules Engine
 *
 * Deterministic rules for which pricing changes trigger alerts.
 * AI does not decide what's important - these rules do.
 */

// ══════════════════════════════════════════════════════════════════════════════
// ALLOWED ALERT TYPES (only 6 high-signal types)
// ══════════════════════════════════════════════════════════════════════════════

export const ALERTABLE_DIFF_TYPES: PricingDiffType[] = [
    "price_increase",
    "price_decrease",
    "plan_added",
    "plan_removed",
    "free_tier_removed",
    "free_tier_added",
];

// ══════════════════════════════════════════════════════════════════════════════
// ALERT THRESHOLDS
// ══════════════════════════════════════════════════════════════════════════════

interface AlertThresholds {
    minSeverity: number;
    minPriceChangePercent: number;
    cooldownHours: number;
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
    minSeverity: 0.5,            // Only alert on severity >= 0.5
    minPriceChangePercent: 5,    // Only alert on price changes >= 5%
    cooldownHours: 24,           // Don't re-alert within 24 hours
};

// ══════════════════════════════════════════════════════════════════════════════
// ALERT RULES
// ══════════════════════════════════════════════════════════════════════════════

export interface AlertDecision {
    shouldAlert: boolean;
    reason: string;
    severity: AlertSeverity;
    priority: number; // 1-10, higher = more important
}

/**
 * Determine if a diff should trigger an alert.
 */
export function shouldTriggerAlert(
    diff: DetectedDiff,
    options?: {
        thresholds?: Partial<AlertThresholds>;
        lastAlertTimestamp?: Date;
        suppressedTypes?: PricingDiffType[];
    }
): AlertDecision {
    const thresholds = { ...DEFAULT_THRESHOLDS, ...options?.thresholds };

    // Rule 1: Check if diff type is alertable
    if (!ALERTABLE_DIFF_TYPES.includes(diff.type)) {
        return {
            shouldAlert: false,
            reason: `Diff type "${diff.type}" is not in alertable types`,
            severity: "low",
            priority: 0,
        };
    }

    // Rule 2: Check minimum severity
    if (diff.severity < thresholds.minSeverity) {
        return {
            shouldAlert: false,
            reason: `Severity ${diff.severity.toFixed(2)} below threshold ${thresholds.minSeverity}`,
            severity: "low",
            priority: 0,
        };
    }

    // Rule 3: Check suppression list
    if (options?.suppressedTypes?.includes(diff.type)) {
        return {
            shouldAlert: false,
            reason: `Diff type "${diff.type}" is suppressed by user`,
            severity: mapSeverity(diff.severity),
            priority: 0,
        };
    }

    // Rule 4: Check cooldown
    if (options?.lastAlertTimestamp) {
        const hoursSinceLastAlert =
            (Date.now() - options.lastAlertTimestamp.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastAlert < thresholds.cooldownHours) {
            return {
                shouldAlert: false,
                reason: `Within cooldown period (${hoursSinceLastAlert.toFixed(1)}h since last alert)`,
                severity: mapSeverity(diff.severity),
                priority: 0,
            };
        }
    }

    // All rules passed - should alert
    return {
        shouldAlert: true,
        reason: "All alert rules passed",
        severity: mapSeverity(diff.severity),
        priority: calculatePriority(diff),
    };
}

/**
 * Filter diffs to only those that should trigger alerts.
 */
export function filterAlertableDiffs(
    diffs: DetectedDiff[],
    options?: {
        thresholds?: Partial<AlertThresholds>;
        suppressedTypes?: PricingDiffType[];
        maxAlerts?: number;
    }
): DetectedDiff[] {
    const maxAlerts = options?.maxAlerts || 5;

    return diffs
        .filter((diff) => {
            const decision = shouldTriggerAlert(diff, options);
            return decision.shouldAlert;
        })
        .sort((a, b) => b.severity - a.severity)
        .slice(0, maxAlerts);
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

function mapSeverity(severity: number): AlertSeverity {
    if (severity >= 0.8) return "high";
    if (severity >= 0.5) return "medium";
    return "low";
}

function calculatePriority(diff: DetectedDiff): number {
    // Base priority from severity (0-10 scale)
    let priority = Math.round(diff.severity * 10);

    // Boost for specific high-impact types
    const boostTypes: Partial<Record<PricingDiffType, number>> = {
        free_tier_removed: 2,
        plan_removed: 1,
        price_increase: 1,
    };

    priority += boostTypes[diff.type] || 0;

    return Math.min(priority, 10);
}

// ══════════════════════════════════════════════════════════════════════════════
// ALERT FORMATTING
// ══════════════════════════════════════════════════════════════════════════════

export interface FormattedAlert {
    title: string;
    headline: string;
    body: string;
    ctaText: string;
    emoji: string;
}

/**
 * Format a diff into user-friendly alert content.
 */
export function formatAlertContent(
    diff: DetectedDiff,
    companyName: string
): FormattedAlert {
    const templates: Record<PricingDiffType, Omit<FormattedAlert, "headline" | "body">> = {
        price_increase: {
            title: "Price Increase Detected",
            ctaText: "View Pricing Change",
            emoji: "📈",
        },
        price_decrease: {
            title: "Price Drop Detected",
            ctaText: "View Pricing Change",
            emoji: "📉",
        },
        plan_added: {
            title: "New Plan Added",
            ctaText: "View New Plan",
            emoji: "➕",
        },
        plan_removed: {
            title: "Plan Removed",
            ctaText: "View Change",
            emoji: "➖",
        },
        free_tier_removed: {
            title: "Free Tier Removed",
            ctaText: "View Impact",
            emoji: "🚨",
        },
        free_tier_added: {
            title: "Free Tier Added",
            ctaText: "View Free Plan",
            emoji: "🎁",
        },
        plan_promoted: {
            title: "Featured Plan Changed",
            ctaText: "View Update",
            emoji: "⭐",
        },
        cta_changed: {
            title: "CTA Updated",
            ctaText: "View Change",
            emoji: "🔄",
        },
        regional_difference: {
            title: "Regional Price Difference",
            ctaText: "Compare Regions",
            emoji: "🌍",
        },
    };

    const template = templates[diff.type];

    return {
        ...template,
        headline: `${template.emoji} ${companyName}: ${diff.description}`,
        body: buildAlertBody(diff),
    };
}

function buildAlertBody(diff: DetectedDiff): string {
    const lines: string[] = [];

    if (diff.before) {
        lines.push(`**Before:** ${diff.before}`);
    }
    if (diff.after) {
        lines.push(`**After:** ${diff.after}`);
    }

    lines.push(`\n*Severity: ${mapSeverity(diff.severity).toUpperCase()}*`);

    return lines.join("\n");
}
