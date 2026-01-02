import type {
    PricingSchema,
    PricingPlan,
    PricingDiff,
    PricingDiffType,
    AlertSeverity,
    DIFF_TYPE_SEVERITY,
} from "@/lib/types";

/**
 * Pricing Diff Engine
 *
 * Compares two PricingSchema objects and detects meaningful changes.
 * Returns structured diffs with severity scores for alerting.
 */

// ══════════════════════════════════════════════════════════════════════════════
// DIFF RESULT TYPES
// ══════════════════════════════════════════════════════════════════════════════

export interface PricingDiffResult {
    hasMeaningfulChanges: boolean;
    diffs: DetectedDiff[];
    overallSeverity: number;
    summary: string;
}

export interface DetectedDiff {
    type: PricingDiffType;
    severity: number;
    planName: string | null;
    before: string | null;
    after: string | null;
    description: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// SEVERITY WEIGHTS
// ══════════════════════════════════════════════════════════════════════════════

const SEVERITY_WEIGHTS: Record<PricingDiffType, number> = {
    price_increase: 0.9,
    price_decrease: 0.85,
    plan_added: 0.8,
    plan_removed: 0.95,
    free_tier_removed: 1.0,
    free_tier_added: 0.7,
    plan_promoted: 0.5,
    cta_changed: 0.4,
    regional_difference: 0.6,
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN DIFF FUNCTION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Compare two pricing schemas and detect meaningful changes.
 */
export function diffPricing(
    before: PricingSchema | null,
    after: PricingSchema
): PricingDiffResult {
    const diffs: DetectedDiff[] = [];

    // First snapshot - no diff possible
    if (!before) {
        return {
            hasMeaningfulChanges: false,
            diffs: [],
            overallSeverity: 0,
            summary: "Initial snapshot captured",
        };
    }

    // 1. Check for free tier changes
    checkFreeTierChanges(before, after, diffs);

    // 2. Check for plan additions/removals
    checkPlanChanges(before, after, diffs);

    // 3. Check for price changes within existing plans
    checkPriceChanges(before, after, diffs);

    // 4. Check for CTA changes
    checkCtaChanges(before, after, diffs);

    // 5. Check for plan promotion changes
    checkPromotionChanges(before, after, diffs);

    // Calculate overall severity
    const overallSeverity = calculateOverallSeverity(diffs);

    // Generate summary
    const summary = generateDiffSummary(diffs);

    return {
        hasMeaningfulChanges: diffs.length > 0,
        diffs,
        overallSeverity,
        summary,
    };
}

// ══════════════════════════════════════════════════════════════════════════════
// CHANGE DETECTION FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

function checkFreeTierChanges(
    before: PricingSchema,
    after: PricingSchema,
    diffs: DetectedDiff[]
): void {
    if (before.has_free_tier && !after.has_free_tier) {
        diffs.push({
            type: "free_tier_removed",
            severity: SEVERITY_WEIGHTS.free_tier_removed,
            planName: null,
            before: "Free tier available",
            after: "Free tier removed",
            description: "Free tier has been removed from pricing",
        });
    } else if (!before.has_free_tier && after.has_free_tier) {
        diffs.push({
            type: "free_tier_added",
            severity: SEVERITY_WEIGHTS.free_tier_added,
            planName: null,
            before: "No free tier",
            after: "Free tier added",
            description: "Free tier has been added to pricing",
        });
    }
}

function checkPlanChanges(
    before: PricingSchema,
    after: PricingSchema,
    diffs: DetectedDiff[]
): void {
    const beforeNames = new Set(before.plans.map((p) => normalizePlanName(p.name)));
    const afterNames = new Set(after.plans.map((p) => normalizePlanName(p.name)));

    // Plans added
    for (const plan of after.plans) {
        const normalizedName = normalizePlanName(plan.name);
        if (!beforeNames.has(normalizedName)) {
            diffs.push({
                type: "plan_added",
                severity: SEVERITY_WEIGHTS.plan_added,
                planName: plan.name,
                before: null,
                after: formatPlanSummary(plan),
                description: `New plan "${plan.name}" added at ${plan.price_raw || "unknown price"}`,
            });
        }
    }

    // Plans removed
    for (const plan of before.plans) {
        const normalizedName = normalizePlanName(plan.name);
        if (!afterNames.has(normalizedName)) {
            diffs.push({
                type: "plan_removed",
                severity: SEVERITY_WEIGHTS.plan_removed,
                planName: plan.name,
                before: formatPlanSummary(plan),
                after: null,
                description: `Plan "${plan.name}" has been removed`,
            });
        }
    }
}

function checkPriceChanges(
    before: PricingSchema,
    after: PricingSchema,
    diffs: DetectedDiff[]
): void {
    for (const afterPlan of after.plans) {
        const beforePlan = findMatchingPlan(before.plans, afterPlan.name);
        if (!beforePlan) continue;

        const beforePrice = extractNumericPrice(beforePlan.price_raw);
        const afterPrice = extractNumericPrice(afterPlan.price_raw);

        if (beforePrice !== null && afterPrice !== null && beforePrice !== afterPrice) {
            const isIncrease = afterPrice > beforePrice;
            const percentChange = Math.abs(((afterPrice - beforePrice) / beforePrice) * 100);

            // Only alert on meaningful price changes (> 5%)
            if (percentChange >= 5) {
                diffs.push({
                    type: isIncrease ? "price_increase" : "price_decrease",
                    severity: isIncrease
                        ? SEVERITY_WEIGHTS.price_increase
                        : SEVERITY_WEIGHTS.price_decrease,
                    planName: afterPlan.name,
                    before: beforePlan.price_raw,
                    after: afterPlan.price_raw,
                    description: `${afterPlan.name} price ${isIncrease ? "increased" : "decreased"} by ${percentChange.toFixed(0)}%`,
                });
            }
        }
    }
}

function checkCtaChanges(
    before: PricingSchema,
    after: PricingSchema,
    diffs: DetectedDiff[]
): void {
    for (const afterPlan of after.plans) {
        const beforePlan = findMatchingPlan(before.plans, afterPlan.name);
        if (!beforePlan) continue;

        const beforeCta = normalizeCta(beforePlan.cta);
        const afterCta = normalizeCta(afterPlan.cta);

        if (beforeCta && afterCta && beforeCta !== afterCta) {
            // Check for significant CTA changes
            const significantChanges = [
                { from: "free", to: "paid", severity: 0.7 },
                { from: "trial", to: "paid", severity: 0.6 },
                { from: "start", to: "contact", severity: 0.5 },
            ];

            for (const change of significantChanges) {
                if (beforeCta.includes(change.from) && afterCta.includes(change.to)) {
                    diffs.push({
                        type: "cta_changed",
                        severity: change.severity,
                        planName: afterPlan.name,
                        before: beforePlan.cta,
                        after: afterPlan.cta,
                        description: `${afterPlan.name} CTA changed from "${beforePlan.cta}" to "${afterPlan.cta}"`,
                    });
                    break;
                }
            }
        }
    }
}

function checkPromotionChanges(
    before: PricingSchema,
    after: PricingSchema,
    diffs: DetectedDiff[]
): void {
    // Check if highlighted plan changed
    if (before.highlighted_plan !== after.highlighted_plan) {
        const beforePlan = before.plans.find((p) => p.id === before.highlighted_plan);
        const afterPlan = after.plans.find((p) => p.id === after.highlighted_plan);

        if (beforePlan || afterPlan) {
            diffs.push({
                type: "plan_promoted",
                severity: SEVERITY_WEIGHTS.plan_promoted,
                planName: afterPlan?.name || null,
                before: beforePlan?.name || "None",
                after: afterPlan?.name || "None",
                description: `Highlighted plan changed from "${beforePlan?.name || "none"}" to "${afterPlan?.name || "none"}"`,
            });
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

function normalizePlanName(name: string): string {
    return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeCta(cta: string): string {
    return cta.toLowerCase().replace(/\s+/g, " ").trim();
}

function findMatchingPlan(plans: PricingPlan[], name: string): PricingPlan | undefined {
    const normalizedName = normalizePlanName(name);
    return plans.find((p) => normalizePlanName(p.name) === normalizedName);
}

function formatPlanSummary(plan: PricingPlan): string {
    return `${plan.name}: ${plan.price_raw || "N/A"} (${plan.billing})`;
}

function extractNumericPrice(priceRaw: string | null): number | null {
    if (!priceRaw) return null;

    // Remove currency symbols and extract number
    const match = priceRaw.match(/[\d,]+(?:\.\d{2})?/);
    if (!match) return null;

    return parseFloat(match[0].replace(/,/g, ""));
}

function calculateOverallSeverity(diffs: DetectedDiff[]): number {
    if (diffs.length === 0) return 0;

    // Use max severity with diminishing returns for additional diffs
    const sortedSeverities = diffs.map((d) => d.severity).sort((a, b) => b - a);

    let total = sortedSeverities[0];
    for (let i = 1; i < sortedSeverities.length; i++) {
        total += sortedSeverities[i] * 0.2; // 20% weight for additional diffs
    }

    return Math.min(total, 1.0);
}

function generateDiffSummary(diffs: DetectedDiff[]): string {
    if (diffs.length === 0) {
        return "No meaningful pricing changes detected";
    }

    // Prioritize high-severity diffs
    const sortedDiffs = [...diffs].sort((a, b) => b.severity - a.severity);
    const topDiffs = sortedDiffs.slice(0, 3);

    const summaries = topDiffs.map((d) => d.description);

    if (diffs.length > 3) {
        summaries.push(`and ${diffs.length - 3} more changes`);
    }

    return summaries.join(". ");
}

// ══════════════════════════════════════════════════════════════════════════════
// REGIONAL COMPARISON
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Compare pricing between two regions.
 * Used to detect regional pricing differences.
 */
export function diffRegionalPricing(
    contextA: { key: string; schema: PricingSchema },
    contextB: { key: string; schema: PricingSchema }
): DetectedDiff[] {
    const diffs: DetectedDiff[] = [];

    for (const planA of contextA.schema.plans) {
        const planB = findMatchingPlan(contextB.schema.plans, planA.name);
        if (!planB) continue;

        const priceA = extractNumericPrice(planA.price_raw);
        const priceB = extractNumericPrice(planB.price_raw);

        if (priceA !== null && priceB !== null) {
            const difference = Math.abs(((priceA - priceB) / priceA) * 100);

            // Alert on >10% regional price difference
            if (difference >= 10) {
                diffs.push({
                    type: "regional_difference",
                    severity: SEVERITY_WEIGHTS.regional_difference,
                    planName: planA.name,
                    before: `${contextA.key}: ${planA.price_raw}`,
                    after: `${contextB.key}: ${planB.price_raw}`,
                    description: `${planA.name} has ${difference.toFixed(0)}% price difference between ${contextA.key.toUpperCase()} and ${contextB.key.toUpperCase()}`,
                });
            }
        }
    }

    return diffs;
}
