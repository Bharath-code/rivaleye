import { describe, it, expect, vi, beforeEach } from "vitest";
import { diffPricing } from "@/lib/diff/pricingDiff";

const { mockScrape } = vi.hoisted(() => ({ mockScrape: vi.fn() }));

vi.mock("../firecrawl", () => ({
    getFirecrawlClient: () => ({ scrape: mockScrape }),
}));

import { scrapePricing, toPricingSchema, isFirecrawlExtractorEnabled, type ExtractedPricing } from "../scrapePage";

const extracted: ExtractedPricing = {
    currency: "USD",
    has_free_tier: true,
    highlighted_plan: null,
    plans: [
        { name: "Free", price_raw: "Free", billing: "monthly", cta: "Start", badges: [], features: ["1 seat"], limits: {}, is_highlighted: false },
        { name: "Pro", price_raw: "$49", billing: "monthly", cta: "Buy", badges: ["Popular"], features: ["10 seats"], limits: {}, is_highlighted: true },
        { name: "Enterprise", price_raw: "Contact us", billing: "unknown", cta: "Talk", badges: [], features: [], limits: {}, is_highlighted: false },
    ],
};

beforeEach(() => {
    mockScrape.mockReset();
    delete process.env.FIRECRAWL_EXTRACTOR;
});

describe("toPricingSchema", () => {
    it("adds id/position and derives price_visible + highlighted_plan", () => {
        const schema = toPricingSchema(extracted);
        expect(schema.plans.map((p) => p.id)).toEqual(["plan-0", "plan-1", "plan-2"]);
        expect(schema.plans[1].price_visible).toBe(true);
        expect(schema.plans[2].price_visible).toBe(false); // "Contact us"
        expect(schema.highlighted_plan).toBe("Pro"); // from is_highlighted fallback
        expect(schema.has_free_tier).toBe(true);
    });

    it("produces output the deterministic diff engine consumes unchanged", () => {
        const before = toPricingSchema(extracted);
        const after = toPricingSchema({
            ...extracted,
            plans: extracted.plans.map((p) => (p.name === "Pro" ? { ...p, price_raw: "$59" } : p)),
        });
        const result = diffPricing(before, after);
        expect(result.hasMeaningfulChanges).toBe(true);
    });
});

describe("scrapePricing", () => {
    it("maps Firecrawl json → PricingSchema", async () => {
        mockScrape.mockResolvedValue({ json: extracted, markdown: "# Pricing" });
        const res = await scrapePricing("https://x.com/pricing");
        expect(res.success).toBe(true);
        if (res.success) {
            expect(res.pricingSchema.plans).toHaveLength(3);
            expect(res.pricingSchema.currency).toBe("USD");
        }
    });

    it("passes changeStatus through for the unchanged pre-filter", async () => {
        mockScrape.mockResolvedValue({ json: extracted, changeTracking: { changeStatus: "same" } });
        const res = await scrapePricing("https://x.com/pricing", undefined, true);
        expect(res.success && res.changeStatus).toBe("same");
    });

    it("returns NO_PRICING when zero plans extracted", async () => {
        mockScrape.mockResolvedValue({ json: { currency: "USD", plans: [] } });
        const res = await scrapePricing("https://x.com/pricing");
        expect(res.success).toBe(false);
        if (!res.success) expect(res.code).toBe("NO_PRICING");
    });

    it("returns PARSE when json is missing/invalid", async () => {
        mockScrape.mockResolvedValue({ json: { plans: "nope" } });
        const res = await scrapePricing("https://x.com/pricing");
        expect(res.success).toBe(false);
        if (!res.success) expect(res.code).toBe("PARSE");
    });

    it("flag defaults off", () => {
        expect(isFirecrawlExtractorEnabled()).toBe(false);
        process.env.FIRECRAWL_EXTRACTOR = "1";
        expect(isFirecrawlExtractorEnabled()).toBe(true);
    });
});
