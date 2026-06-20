import { describe, it, expect } from "vitest";
import { deriveRadarInsight, type RadarPoint } from "../radarInsight";

function p(
    name: string,
    featureDensity: number,
    startingPrice: number,
    hasFreeTier = false
): RadarPoint {
    return { id: name, name, featureDensity, startingPrice, hasFreeTier };
}

describe("deriveRadarInsight", () => {
    it("asks for more competitors below 3 points", () => {
        expect(deriveRadarInsight([])).toMatch(/Add 3 more/);
        expect(deriveRadarInsight([p("Acme", 5, 49)])).toMatch(/Add 2 more/);
        expect(deriveRadarInsight([p("Acme", 5, 49), p("Beta", 3, 99)])).toMatch(
            /Add 1 more/
        );
    });

    it("names disruptors in the high-feature low-price quadrant", () => {
        const insight = deriveRadarInsight([
            p("Acme", 9, 19),
            p("Beta", 4, 99),
            p("Cee", 3, 120),
        ]);
        expect(insight).toContain("Acme");
        expect(insight).toMatch(/high-feature, low-price quadrant/);
    });

    it("reports the real price spread", () => {
        const insight = deriveRadarInsight([
            p("Acme", 9, 19),
            p("Beta", 4, 99),
            p("Cee", 3, 120),
        ]);
        expect(insight).toContain("$19");
        expect(insight).toContain("$120");
    });

    it("reports free-tier counts", () => {
        const insight = deriveRadarInsight([
            p("Acme", 9, 19, true),
            p("Beta", 4, 99, false),
            p("Cee", 3, 120, true),
        ]);
        expect(insight).toMatch(/2 of 3 offer a free tier/);
    });
});
