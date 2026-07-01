import { describe, it, expect } from "vitest";
import type { PricingContext, PricingSchema } from "@/lib/types";
import { scrapePricing } from "@/lib/crawler/scrapePage";
import { scrapeWithGeoContext } from "@/lib/crawler/geoPlaywright";
import { diffPricing } from "@/lib/diff/pricingDiff";

/**
 * P1 shadow-parity gate. Runs the new Firecrawl extractor and the current
 * Playwright/vision path against the SAME live URLs and reports whether the
 * produced PricingSchema (and the diffs the moat engine derives from it) match.
 *
 * Real network + a browser — gated off the normal suite. Run explicitly:
 *   SHADOW_URLS="https://a.com/pricing,https://b.com/pricing" npm run shadow
 *   FIRECRAWL_API_KEY=... GEMINI_API_KEY=...            (required)
 *   SHADOW_STRICT=1   -> fail the run on any divergence (default: report only)
 *
 * ponytail: a vitest file (only runner here that resolves the @/ alias), skipped
 * unless SHADOW_URLS is set. No tsx dep, no bundler.
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

/** Fields that actually matter for parity — normalized so key order/ids don't count. */
function fingerprint(s: PricingSchema) {
    return {
        currency: s.currency,
        has_free_tier: s.has_free_tier,
        highlighted_plan: s.highlighted_plan,
        prices: Object.fromEntries(
            [...s.plans].sort((a, b) => a.name.localeCompare(b.name)).map((p) => [p.name, p.price_raw])
        ),
    };
}

function divergences(pw: PricingSchema, fc: PricingSchema): string[] {
    const out: string[] = [];
    const a = fingerprint(pw);
    const b = fingerprint(fc);
    if (a.currency !== b.currency) out.push(`currency ${a.currency} vs ${b.currency}`);
    if (a.has_free_tier !== b.has_free_tier) out.push(`has_free_tier ${a.has_free_tier} vs ${b.has_free_tier}`);
    if (a.highlighted_plan !== b.highlighted_plan) out.push(`highlighted ${a.highlighted_plan} vs ${b.highlighted_plan}`);
    const names = new Set([...Object.keys(a.prices), ...Object.keys(b.prices)]);
    for (const n of names) {
        if (a.prices[n] !== b.prices[n]) out.push(`plan "${n}": ${a.prices[n] ?? "—"} vs ${b.prices[n] ?? "—"}`);
    }
    return out;
}

describe.skipIf(urls.length === 0)("shadow parity: Firecrawl vs Playwright extractor", () => {
    let matched = 0;

    for (const url of urls) {
        it(`parity for ${url}`, async () => {
            const [pw, fc] = await Promise.all([
                scrapeWithGeoContext(url, context),
                scrapePricing(url, context),
            ]);

            if (!pw.success || !fc.success) {
                const msg = `[shadow] ${url} — playwright:${pw.success ? "ok" : (pw as { error: string }).error} firecrawl:${fc.success ? "ok" : (fc as { error: string }).error}`;
                console.warn(msg);
                if (strict) expect.fail(msg);
                return;
            }

            const fieldDiffs = divergences(pw.pricingSchema, fc.pricingSchema);
            const engine = diffPricing(pw.pricingSchema, fc.pricingSchema);

            if (fieldDiffs.length === 0 && !engine.hasMeaningfulChanges) {
                matched++;
                console.log(`[shadow] ✓ ${url} — ${fc.pricingSchema.plans.length} plans, parity`);
            } else {
                console.warn(
                    `[shadow] ✗ ${url}\n  fields: ${fieldDiffs.join("; ") || "—"}\n  engine: ${engine.diffs.map((d) => `${d.type}(${d.planName})`).join(", ") || "—"}`
                );
                if (strict) expect(fieldDiffs, `divergence for ${url}`).toEqual([]);
            }
        }, 90_000);
    }

    it("summary", () => {
        console.log(`[shadow] parity: ${matched}/${urls.length} URLs matched`);
        expect(urls.length).toBeGreaterThan(0);
    });
});
