/**
 * PAR-2: which sources do answer engines cite? Aggregated from the citation
 * URLs already persisted on every aeo_visibility row.
 */
export function topCitedDomains(
    rows: Array<{ citations: unknown }>,
    limit: number = 10
): Array<{ domain: string; count: number }> {
    const counts = new Map<string, number>();
    for (const row of rows) {
        if (!Array.isArray(row.citations)) continue;
        for (const c of row.citations) {
            if (typeof c !== "string") continue;
            try {
                const domain = new URL(c).hostname.replace(/^www\./, "").toLowerCase();
                counts.set(domain, (counts.get(domain) ?? 0) + 1);
            } catch {
                // malformed citation URL — skip
            }
        }
    }
    return [...counts.entries()]
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain))
        .slice(0, limit);
}
