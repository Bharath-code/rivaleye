import { describe, it, expect } from "vitest";
import { topCitedDomains } from "../citations";

describe("topCitedDomains", () => {
    it("counts and ranks domains across rows, normalizing www", () => {
        const rows = [
            { citations: ["https://www.g2.com/x", "https://stripe.com/pricing"] },
            { citations: ["https://g2.com/y"] },
            { citations: ["https://reddit.com/r/saas"] },
        ];
        expect(topCitedDomains(rows)).toEqual([
            { domain: "g2.com", count: 2 },
            { domain: "reddit.com", count: 1 },
            { domain: "stripe.com", count: 1 },
        ]);
    });

    it("skips malformed URLs and non-array citations", () => {
        const rows = [
            { citations: ["not a url", "https://g2.com/a"] },
            { citations: null },
            { citations: "https://g2.com" },
        ];
        expect(topCitedDomains(rows)).toEqual([{ domain: "g2.com", count: 1 }]);
    });

    it("respects the limit", () => {
        const rows = [
            { citations: ["https://a.com", "https://b.com", "https://c.com"] },
        ];
        expect(topCitedDomains(rows, 2)).toHaveLength(2);
    });
});
