import type { PricingSchema, AlertSeverity, PricingDiffType } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRateToUsd } from "@/lib/currency";

/**
 * Cross-Region Pricing Comparison
 *
 * Compares pricing across different geographic regions for the same competitor.
 * Detects hidden regional discounts, geo-fencing, and pricing parity violations.
 */

// ──────────────────────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────────────────────

interface RegionalSnapshot {
    region: string;
    pricingSchema: PricingSchema;
    currency: string;
    snapshotId: string;
}

interface PricePoint {
    planName: string;
    region: string;
    priceRaw: string;
    priceNumeric: number;
    currency: string;
}

interface RegionalDifference {
    planName: string;
    baseRegion: string;
    basePrice: number;
    comparingRegion: string;
    comparingPrice: number;
    priceDifferencePercent: number;
    isDiscount: boolean;
    severity: AlertSeverity;
}

export interface RegionalComparisonResult {
    hasRegionalDifferences: boolean;
    differences: RegionalDifference[];
    summary: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN COMPARISON FUNCTION
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compare pricing across regions for a single competitor.
 * Returns detected regional differences.
 */
export async function compareRegionalPricing(
    snapshots: RegionalSnapshot[]
): Promise<RegionalComparisonResult> {
    if (snapshots.length < 2) {
        return {
            hasRegionalDifferences: false,
            differences: [],
            summary: "Insufficient regions for comparison",
        };
    }

    // Extract normalized price points
    const pricePoints: PricePoint[] = [];

    for (const snapshot of snapshots) {
        for (const plan of snapshot.pricingSchema.plans) {
            if (!plan.price_raw) continue;

            const numeric = extractNumericPrice(plan.price_raw);
            if (numeric === null) continue;

            // Use real exchange rates
            const rate = await getRateToUsd(snapshot.currency);
            const normalizedToUsd = numeric * rate;

            pricePoints.push({
                planName: plan.name.toLowerCase().trim(),
                region: snapshot.region,
                priceRaw: plan.price_raw,
                priceNumeric: normalizedToUsd,
                currency: snapshot.currency,
            });
        }
    }

    // Group by plan name
    const planGroups = new Map<string, PricePoint[]>();
    for (const point of pricePoints) {
        const existing = planGroups.get(point.planName) || [];
        existing.push(point);
        planGroups.set(point.planName, existing);
    }

    // Find differences
    const differences: RegionalDifference[] = [];

    for (const [planName, points] of planGroups) {
        if (points.length < 2) continue;

        // Use US price as baseline (or first region if no US)
        const baseline = points.find((p) => p.region === "us") || points[0];

        for (const point of points) {
            if (point.region === baseline.region) continue;

            const priceDiff = point.priceNumeric - baseline.priceNumeric;
            const percentDiff = ((priceDiff / baseline.priceNumeric) * 100);

            // Only flag significant differences (>10%)
            if (Math.abs(percentDiff) < 10) continue;

            const severity = getSeverityForDifference(percentDiff);

            differences.push({
                planName,
                baseRegion: baseline.region.toUpperCase(),
                basePrice: baseline.priceNumeric,
                comparingRegion: point.region.toUpperCase(),
                comparingPrice: point.priceNumeric,
                priceDifferencePercent: Math.round(percentDiff),
                isDiscount: percentDiff < 0,
                severity,
            });
        }
    }

    // Generate summary
    const summary = generateSummary(differences);

    return {
        hasRegionalDifferences: differences.length > 0,
        differences,
        summary,
    };
}

// ──────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Extract numeric price from raw string like "$49/mo" or "₹999"
 */
function extractNumericPrice(priceRaw: string): number | null {
    // Remove currency symbols and extract number
    const cleaned = priceRaw
        .replace(/[^0-9.,]/g, "")
        .replace(",", "");

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
}

/**
 * Determine alert severity based on price difference
 */
function getSeverityForDifference(percentDiff: number): AlertSeverity {
    const absDiff = Math.abs(percentDiff);
    if (absDiff >= 30) return "high";
    if (absDiff >= 20) return "medium";
    return "low";
}

/**
 * Generate human-readable summary
 */
function generateSummary(differences: RegionalDifference[]): string {
    if (differences.length === 0) {
        return "No significant regional pricing differences detected.";
    }

    const discounts = differences.filter((d) => d.isDiscount);
    const premiums = differences.filter((d) => !d.isDiscount);

    const parts: string[] = [];

    if (discounts.length > 0) {
        const regions = [...new Set(discounts.map((d) => d.comparingRegion))];
        parts.push(`Hidden discounts in ${regions.join(", ")}`);
    }

    if (premiums.length > 0) {
        const regions = [...new Set(premiums.map((d) => d.comparingRegion))];
        parts.push(`Premium pricing in ${regions.join(", ")}`);
    }

    return parts.join(". ") + ".";
}

// ──────────────────────────────────────────────────────────────────────────────
// DATABASE INTEGRATION
// ──────────────────────────────────────────────────────────────────────────────

interface ContextRow {
    id: string;
    key: string;
}

interface SnapshotRow {
    id: string;
    pricing_schema: PricingSchema | null;
    currency_detected: string | null;
}

/**
 * Fetch latest snapshots for all regions of a competitor
 */
export async function getLatestRegionalSnapshots(
    competitorId: string,
    supabase: SupabaseClient
): Promise<RegionalSnapshot[]> {
    // Get all pricing contexts for this competitor
    const { data: contexts } = await supabase
        .from("pricing_contexts")
        .select("id, key")
        .eq("competitor_id", competitorId) as { data: ContextRow[] | null };

    if (!contexts || contexts.length < 2) {
        return [];
    }

    const snapshots: RegionalSnapshot[] = [];

    for (const ctx of contexts) {
        // Get latest snapshot for each context
        const { data: snapshot } = await supabase
            .from("pricing_snapshots")
            .select("id, pricing_schema, currency_detected")
            .eq("pricing_context_id", ctx.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single() as { data: SnapshotRow | null };

        if (snapshot && snapshot.pricing_schema) {
            snapshots.push({
                region: ctx.key,
                pricingSchema: snapshot.pricing_schema,
                currency: snapshot.currency_detected || "USD",
                snapshotId: snapshot.id,
            });
        }
    }

    return snapshots;
}

/**
 * Simple diff object for regional comparison
 */
export interface SimpleDiff {
    type: PricingDiffType;
    severity: AlertSeverity;
    planName: string;
    field: string;
    before: string;
    after: string;
    description: string;
    percentChange: number;
}

/**
 * Create regional difference alert
 */
export function createRegionalDiffAlert(
    diff: RegionalDifference,
    competitorName: string
): SimpleDiff {
    const description = diff.isDiscount
        ? `${competitorName} offers ${Math.abs(diff.priceDifferencePercent)}% lower pricing in ${diff.comparingRegion} compared to ${diff.baseRegion}`
        : `${competitorName} charges ${diff.priceDifferencePercent}% more in ${diff.comparingRegion} compared to ${diff.baseRegion}`;

    return {
        type: "regional_difference",
        severity: diff.severity,
        planName: diff.planName,
        field: "price",
        before: `$${diff.basePrice.toFixed(2)} (${diff.baseRegion})`,
        after: `$${diff.comparingPrice.toFixed(2)} (${diff.comparingRegion})`,
        description,
        percentChange: diff.priceDifferencePercent,
    };
}
