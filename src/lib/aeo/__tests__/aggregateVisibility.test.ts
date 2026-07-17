import { describe, it, expect } from "vitest";
import { aggregateVisibility } from "../aggregateVisibility";
import type { VisibilitySummary } from "../scan";

function summary(total: number, mentions: number): VisibilitySummary {
    return {
        total,
        mentions,
        visibility_pct: total > 0 ? Math.round((mentions / total) * 1000) / 10 : 0,
        avg_position: null,
        by_model: [],
        own: null,
    };
}

describe("aggregateVisibility", () => {
    it("returns a zeroed aggregate for no competitors", () => {
        const agg = aggregateVisibility([]);
        expect(agg.total).toBe(0);
        expect(agg.mentions).toBe(0);
        expect(agg.visibility_pct).toBe(0);
        expect(agg.scanned).toBe(0);
        expect(agg.tracked).toBe(0);
        expect(agg.competitors).toEqual([]);
    });

    it("treats null summaries as tracked-but-unscanned", () => {
        const agg = aggregateVisibility([
            { id: "a", name: "Acme", summary: null },
        ]);
        expect(agg.tracked).toBe(1);
        expect(agg.scanned).toBe(0);
        expect(agg.competitors[0].scanned).toBe(false);
        expect(agg.visibility_pct).toBe(0);
    });

    it("blends visibility from raw counts, not an average of percentages", () => {
        // Acme: 9/10 = 90%, Beta: 1/90 ≈ 1.1%.
        // Average of pcts would be ~45.5%; weighted blend is 10/100 = 10%.
        const agg = aggregateVisibility([
            { id: "a", name: "Acme", summary: summary(10, 9) },
            { id: "b", name: "Beta", summary: summary(90, 1) },
        ]);
        expect(agg.total).toBe(100);
        expect(agg.mentions).toBe(10);
        expect(agg.visibility_pct).toBe(10);
        expect(agg.scanned).toBe(2);
    });

    it("sorts competitors by visibility desc then name", () => {
        const agg = aggregateVisibility([
            { id: "b", name: "Beta", summary: summary(10, 1) },
            { id: "a", name: "Acme", summary: summary(10, 9) },
            { id: "c", name: "Cee", summary: summary(10, 1) },
        ]);
        expect(agg.competitors.map((c) => c.id)).toEqual(["a", "b", "c"]);
    });
});

describe("own share blending", () => {
    const summary = (
        total: number,
        mentions: number,
        own: { total: number; mentions: number; visibility_pct: number } | null
    ) => ({
        total,
        mentions,
        visibility_pct: total ? (mentions / total) * 100 : 0,
        avg_position: null,
        by_model: [],
        own,
    });

    it("is null when no summary has own data", () => {
        const out = aggregateVisibility([
            { id: "a", name: "A", summary: summary(5, 2, null) },
        ]);
        expect(out.own).toBeNull();
    });

    it("blends own share from raw counts, weighting by query volume", () => {
        const out = aggregateVisibility([
            {
                id: "a",
                name: "A",
                summary: summary(10, 5, { total: 10, mentions: 1, visibility_pct: 10 }),
            },
            {
                id: "b",
                name: "B",
                summary: summary(2, 2, { total: 2, mentions: 2, visibility_pct: 100 }),
            },
        ]);
        // raw blend: 3/12 = 25%, NOT avg(10,100)=55%
        expect(out.own).toEqual({ total: 12, mentions: 3, visibility_pct: 25 });
    });
});
