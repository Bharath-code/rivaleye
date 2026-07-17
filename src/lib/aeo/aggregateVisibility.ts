import type { VisibilitySummary } from "./scan";

export interface CompetitorVisibility {
    id: string;
    name: string;
    visibility_pct: number;
    mentions: number;
    total: number;
    scanned: boolean;
}

export interface AggregateVisibility {
    /** Total answer-engine queries observed across all competitors in the window. */
    total: number;
    /** Total mentions across all competitors. */
    mentions: number;
    /** Blended visibility share (mentions / total), 0 when no data. */
    visibility_pct: number;
    /** Competitors that have at least one scan in the window. */
    scanned: number;
    /** Competitors enrolled in AEO tracking (with or without data yet). */
    tracked: number;
    /** Per-competitor rows, sorted by visibility desc then name. */
    competitors: CompetitorVisibility[];
    /** Blended own-brand share across all scanned competitors; null when the
     *  user has no brand configured / no own-brand data in the window. */
    own: { total: number; mentions: number; visibility_pct: number } | null;
}

function round1(n: number): number {
    return Math.round(n * 10) / 10;
}

/**
 * Blend per-competitor AEO summaries into a single dashboard-level view.
 *
 * The blended `visibility_pct` is computed from raw mention/total counts
 * (not an average of percentages) so competitors with more queries are
 * weighted correctly.
 */
export function aggregateVisibility(
    rows: Array<{ id: string; name: string; summary: VisibilitySummary | null }>
): AggregateVisibility {
    let total = 0;
    let mentions = 0;
    let scanned = 0;
    let ownTotal = 0;
    let ownMentions = 0;

    const competitors: CompetitorVisibility[] = rows.map(({ id, name, summary }) => {
        const t = summary?.total ?? 0;
        const m = summary?.mentions ?? 0;
        total += t;
        mentions += m;
        if (t > 0) scanned += 1;
        if (summary?.own) {
            ownTotal += summary.own.total;
            ownMentions += summary.own.mentions;
        }
        return {
            id,
            name,
            total: t,
            mentions: m,
            visibility_pct: summary?.visibility_pct ?? 0,
            scanned: t > 0,
        };
    });

    competitors.sort(
        (a, b) =>
            b.visibility_pct - a.visibility_pct || a.name.localeCompare(b.name)
    );

    return {
        total,
        mentions,
        visibility_pct: total > 0 ? round1((mentions / total) * 100) : 0,
        scanned,
        tracked: rows.length,
        competitors,
        own:
            ownTotal > 0
                ? {
                      total: ownTotal,
                      mentions: ownMentions,
                      visibility_pct: round1((ownMentions / ownTotal) * 100),
                  }
                : null,
    };
}
