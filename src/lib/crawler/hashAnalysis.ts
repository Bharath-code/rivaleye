import { createHash } from "crypto";
import type { CompetitorAnalysis } from "@/lib/ai/visionAnalyzer";

/**
 * Hash key analysis fields for change detection.
 *
 * Single source of truth — used by:
 * - src/app/api/analyze-competitor/route.ts (manual scans)
 * - src/trigger/analyzeCompetitor.ts (on-demand trigger task)
 * - src/trigger/dailyAnalysis.ts (per-user scheduled runs)
 * - src/trigger/dailyPricingAnalysis.ts (geo-aware daily)
 *
 * IMPORTANT: any change to the field selection here changes the
 * "change" signal across the entire system. The 4 callers were
 * historically 4 separate copies of this function — keeping them
 * in sync was a bug magnet. They now all import this single function.
 *
 * Field selection rationale:
 * - pricing.plans: { name, price, credits } — actual price values + plan names
 *   (NOT billing period, NOT features, NOT cta — those drift for non-pricing reasons)
 * - features.highlighted: the marketing features list (frequently changes)
 * - positioning.valueProposition: the headline positioning (rarely changes, high signal)
 */
export function hashAnalysis(analysis: CompetitorAnalysis): string {
    const keyData = {
        pricing: analysis.pricing?.plans?.map(p => ({
            name: p.name,
            price: p.price,
            credits: p.credits,
        })),
        features: analysis.features?.highlighted,
        positioning: analysis.positioning?.valueProposition,
    };

    return createHash("sha256")
        .update(JSON.stringify(keyData))
        .digest("hex");
}
