import { describe, it, expect } from "vitest";
import type { PricingContext } from "@/lib/types";
import { scrapePricing } from "@/lib/crawler/scrapePage";

/**
 * Live Firecrawl extraction smoke test (was the P3 shadow-parity gate; the
 * Playwright control path is deleted, so this now just proves the extractor
 * works against real pricing pages).
 *
 * Real network + Firecrawl credits — gated off the normal suite. Run explicitly:
 *   SHADOW_URLS="https://a.com/pricing,https://b.com/pricing" npm run shadow
 *   FIRECRAWL_API_KEY=...                                  (required)
 *   SHADOW_STRICT=1   -> fail the run on any extraction failure (default: report only)
 */

const urls = (process.env.SHADOW_URLS ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);

const strict = process.env.SHADOW_STRICT === "1";

const context: PricingContext = {
    id: "shadow-global",
    key: "global",
    country: null,
    currency: "USD",
    locale: "en-US",
    timezone: "UTC",
    requires_browser: true,
    created_at: new Date().toISOString(),
};

describe.skipIf(urls.length === 0)("live Firecrawl pricing extraction", () => {
    let ok = 0;

    for (const url of urls) {
        it(`extracts pricing from ${url}`, async () => {
            const fc = await scrapePricing(url, context);

            if (!fc.success) {
                const msg = `[smoke] ✗ ${url} — ${fc.code}: ${fc.error}`;
                console.warn(msg);
                if (strict) expect.fail(msg);
                return;
            }

            ok++;
            console.log(
                `[smoke] ✓ ${url} — ${fc.pricingSchema.plans.length} plans, currency ${fc.pricingSchema.currency}`
            );
            expect(fc.pricingSchema.plans.length).toBeGreaterThan(0);
        }, 90_000);
    }

    it("summary", () => {
        console.log(`[smoke] extraction: ${ok}/${urls.length} URLs succeeded`);
        expect(urls.length).toBeGreaterThan(0);
    });
});
