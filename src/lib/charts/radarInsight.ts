export interface RadarPoint {
    id: string;
    name: string;
    featureDensity: number;
    startingPrice: number;
    hasFreeTier: boolean;
}

function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

function fmtPrice(n: number): string {
    return n === 0 ? "$0" : `$${Math.round(n)}`;
}

function joinNames(names: string[]): string {
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Derive a grounded one-to-two sentence insight from the market-radar points.
 *
 * Deterministic and data-driven: it names real competitors, the real price
 * spread, and the actual occupied/empty quadrants. No fabricated claims.
 */
export function deriveRadarInsight(points: RadarPoint[]): string {
    const n = points.length;
    if (n < 3) {
        const need = 3 - n;
        return `Mapping ${n} competitor${n === 1 ? "" : "s"}. Add ${need} more to activate high-fidelity quadrant analysis.`;
    }

    const medPrice = median(points.map((p) => p.startingPrice));
    const medFeat = median(points.map((p) => p.featureDensity));

    const disruptors = points.filter(
        (p) => p.featureDensity >= medFeat && p.startingPrice <= medPrice
    );

    const prices = points.map((p) => p.startingPrice);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const freeCount = points.filter((p) => p.hasFreeTier).length;

    const lead =
        disruptors.length > 0
            ? `${joinNames(disruptors.slice(0, 2).map((d) => d.name))} hold the high-feature, low-price quadrant — the toughest position to undercut on value.`
            : `No competitor occupies the high-feature, low-price quadrant — that's open white-space for a disruptor play.`;

    const spread =
        max > min
            ? ` Starting prices span ${fmtPrice(min)}–${fmtPrice(max)}`
            : ` Starting prices cluster around ${fmtPrice(min)}`;

    const free =
        freeCount > 0
            ? `, and ${freeCount} of ${n} offer a free tier.`
            : `, and none offer a free tier.`;

    return lead + spread + free;
}
