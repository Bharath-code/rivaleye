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
