export interface OwnShare {
    total: number;
    mentions: number;
    visibility_pct: number;
}

/**
 * Own-brand share over scan rows. Rows with own_mentioned === null were
 * scanned before the user configured a brand — excluded, not counted as 0,
 * so history from before PAR-1 can't drag the score down.
 */
export function computeOwnShare(
    rows: Array<{ own_mentioned: boolean | null }>
): OwnShare | null {
    const withData = rows.filter((r) => r.own_mentioned !== null);
    if (withData.length === 0) return null;
    const mentions = withData.filter((r) => r.own_mentioned).length;
    return {
        total: withData.length,
        mentions,
        visibility_pct:
            Math.round((mentions / withData.length) * 1000) / 10,
    };
}
