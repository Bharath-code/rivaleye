import type { DiffResult, MeaningfulnessResult } from "@/lib/types";

/**
 * Meaningful Diff Classifier
 * 
 * Determines if a diff represents a meaningful competitive signal
 * vs. noise (grammar fixes, date updates, footer changes).
 */

// Pricing-related keywords
const PRICING_KEYWORDS = [
    /\$\d+/,                              // Dollar amounts
    /€\d+/,                               // Euro amounts
    /£\d+/,                               // Pound amounts
    /\d+\s*(\/|per)\s*(month|year|mo|yr)/i,
    /free\s*trial/i,
    /\d+%\s*(off|discount)/i,
    /pricing/i,
    /subscription/i,
    /billed\s*(monthly|annually|yearly)/i,
];

// Plan-related keywords
const PLAN_KEYWORDS = [
    /\b(basic|starter|pro|premium|enterprise|team|business|free|plus)\s*(plan|tier)?\b/i,
    /\b(plan|tier)s?\b/i,
    /upgrade/i,
    /downgrade/i,
];

// CTA-related keywords
const CTA_KEYWORDS = [
    /get started/i,
    /start free/i,
    /try for free/i,
    /contact sales/i,
    /book a demo/i,
    /request demo/i,
    /sign up/i,
    /buy now/i,
    /subscribe/i,
    /talk to sales/i,
];

// Feature-related patterns
const FEATURE_KEYWORDS = [
    /\b(feature|includes?|included|unlimited|limited|up to \d+)\b/i,
    /✓|✗|✔|✕|✘|✅|❌/,                    // Checkmarks
    /\d+\s*(gb|tb|mb|users?|seats?|projects?|integrations?)/i,
];

// Positioning/headline patterns
const POSITIONING_KEYWORDS = [
    /^[A-Z].*[.!]$/m,                    // Headline-style sentences
    /the #?\d+|best|leading|top|fastest|easiest|simplest|most/i,
    /introducing|announcing|new|launch/i,
];

// Noise patterns to ignore
const NOISE_PATTERNS = [
    /\d{4}/,                              // Just a year
    /cookies?/i,
    /privacy/i,
    /terms/i,
    /\ball rights reserved\b/i,
];

function containsPatterns(text: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(text));
}

function isNoiseOnly(text: string): boolean {
    return containsPatterns(text, NOISE_PATTERNS) &&
        !containsPatterns(text, [...PRICING_KEYWORDS, ...PLAN_KEYWORDS, ...CTA_KEYWORDS]);
}

export function isMeaningful(diff: DiffResult): MeaningfulnessResult {
    if (!diff.hasChanges || diff.changedBlocks.length === 0) {
        return {
            isMeaningful: false,
            reason: "No changes detected",
        };
    }

    // Combine all changed text for analysis
    const allChangedText = diff.changedBlocks
        .map(b => `${b.oldText} ${b.newText}`)
        .join(" ");

    // If it's all noise, skip
    if (isNoiseOnly(allChangedText)) {
        return {
            isMeaningful: false,
            reason: "Changes appear to be footer/legal/date updates only",
        };
    }

    // Check for pricing changes (highest priority)
    if (containsPatterns(allChangedText, PRICING_KEYWORDS)) {
        return {
            isMeaningful: true,
            reason: "Pricing information changed",
            signalType: "pricing",
        };
    }

    // Check for plan changes
    if (containsPatterns(allChangedText, PLAN_KEYWORDS)) {
        return {
            isMeaningful: true,
            reason: "Plan or tier structure changed",
            signalType: "plan",
        };
    }

    // Check for CTA changes
    if (containsPatterns(allChangedText, CTA_KEYWORDS)) {
        return {
            isMeaningful: true,
            reason: "Call-to-action language changed",
            signalType: "cta",
        };
    }

    // Check for feature changes
    if (containsPatterns(allChangedText, FEATURE_KEYWORDS)) {
        return {
            isMeaningful: true,
            reason: "Feature or capability description changed",
            signalType: "feature",
        };
    }

    // Check for positioning changes
    if (containsPatterns(allChangedText, POSITIONING_KEYWORDS)) {
        return {
            isMeaningful: true,
            reason: "Headline or positioning language changed",
            signalType: "positioning",
        };
    }

    // If significant text changed but didn't match keywords, still flag as potentially meaningful
    const totalChangeLength = allChangedText.length;
    if (totalChangeLength > 100) {
        return {
            isMeaningful: true,
            reason: "Substantial content change detected",
        };
    }

    return {
        isMeaningful: false,
        reason: "Changes appear minor (grammar, formatting, or small copy edits)",
    };
}
