import { describe, it, expect, vi, beforeEach } from "vitest";
import { diffPricing } from "@/lib/diff/pricingDiff";

const { mockScrape } = vi.hoisted(() => ({ mockScrape: vi.fn() }));

vi.mock("../firecrawl", () => ({
    getFirecrawlClient: () => ({ scrape: mockScrape }),
}));

import { scrapePricing, toPricingSchema, isFirecrawlExtractorEnabled, fetchScreenshotBuffer, type ExtractedPricing } from "../scrapePage";

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

    it("requests a screenshot format only when asked, and returns its URL", async () => {
        mockScrape.mockResolvedValue({ json: extracted, screenshot: "https://fc.dev/shot.png" });
        const res = await scrapePricing("https://x.com/pricing", undefined, false, true);
        expect(res.success && res.screenshotUrl).toBe("https://fc.dev/shot.png");
        const formats = mockScrape.mock.calls[0][1].formats;
        expect(formats).toContainEqual({ type: "screenshot", fullPage: true });
    });

    it("omits the screenshot format by default", async () => {
        mockScrape.mockResolvedValue({ json: extracted });
        await scrapePricing("https://x.com/pricing");
        const formats = mockScrape.mock.calls[0][1].formats;
        expect(formats.some((f: unknown) => typeof f === "object" && f !== null && (f as { type?: string }).type === "screenshot")).toBe(false);
    });

    it("sends real geo (location.country + languages) to Firecrawl when context has a country", async () => {
        mockScrape.mockResolvedValue({ json: extracted });
        const ctx = { id: "c1", key: "eu", country: "DE", currency: "EUR", locale: "de-DE", timezone: "Europe/Berlin", requires_browser: false, created_at: "" } as const;
        await scrapePricing("https://x.com/pricing", ctx);
        expect(mockScrape.mock.calls[0][1].location).toEqual({ country: "DE", languages: ["de-DE"] });
    });

    it("omits location when the context country is null", async () => {
        mockScrape.mockResolvedValue({ json: extracted });
        const ctx = { id: "c1", key: "global", country: null, currency: null, locale: "en-US", timezone: "UTC", requires_browser: false, created_at: "" } as const;
        await scrapePricing("https://x.com/pricing", ctx);
        expect(mockScrape.mock.calls[0][1].location).toBeUndefined();
    });

    it("flag defaults off", () => {
        expect(isFirecrawlExtractorEnabled()).toBe(false);
        process.env.FIRECRAWL_EXTRACTOR = "1";
        expect(isFirecrawlExtractorEnabled()).toBe(true);
    });
});

describe("fetchScreenshotBuffer", () => {
    it("fetches a screenshot URL into a Buffer", async () => {
        const bytes = new Uint8Array([1, 2, 3, 4]);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => bytes.buffer }));
        const buf = await fetchScreenshotBuffer("https://fc.dev/shot.png");
        expect(Buffer.isBuffer(buf)).toBe(true);
        expect([...buf]).toEqual([1, 2, 3, 4]);
        vi.unstubAllGlobals();
    });

    it("throws on a non-ok response", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
        await expect(fetchScreenshotBuffer("https://fc.dev/missing.png")).rejects.toThrow("404");
        vi.unstubAllGlobals();
    });
});
