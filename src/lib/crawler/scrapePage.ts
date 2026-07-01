import { z } from "zod";
import type { FormatOption, ScrapeOptions } from "@mendable/firecrawl-js";
import type { PricingContext, PricingPlan, PricingSchema } from "@/lib/types";
import { getFirecrawlClient } from "./firecrawl";

/**
 * Firecrawl-v2 structured pricing extractor (P1, flag-gated).
 *
 * Replaces the Playwright-screenshot + Gemini-vision extractor with a single
 * hosted Firecrawl `scrape` using `json` structured extraction. Output is
 * mapped to the canonical `PricingSchema` so the deterministic diff engine
 * (`src/lib/diff/**`) consumes it unchanged.
 *
 * ponytail: additive + behind FIRECRAWL_EXTRACTOR — no cutover here (that's P3).
 */

const TIMEOUT_MS = 45000;

/** Schema Firecrawl extracts into. Flat + LLM-friendly; mapped to PricingSchema below. */
export const PRICING_SCHEMA = z.object({
    currency: z.string().default("USD"),
    has_free_tier: z.boolean().default(false),
    highlighted_plan: z.string().nullable().default(null),
    plans: z
        .array(
            z.object({
                name: z.string(),
                price_raw: z.string().nullable().default(null),
                billing: z
                    .enum(["monthly", "yearly", "one-time", "unknown"])
                    .default("unknown"),
                cta: z.string().default(""),
                badges: z.array(z.string()).default([]),
                features: z.array(z.string()).default([]),
                limits: z.record(z.string(), z.string()).default({}),
                is_highlighted: z.boolean().default(false),
            })
        )
        .default([]),
});

export type ExtractedPricing = z.infer<typeof PRICING_SCHEMA>;

/**
 * Firecrawl gets a plain JSON Schema, NOT the Zod object: firecrawl-js@4 detects
 * Zod via v3 internals, so a Zod v4 schema is silently dropped and no extraction
 * runs. z.toJSONSchema() sidesteps that.
 */
const PRICING_JSON_SCHEMA = z.toJSONSchema(PRICING_SCHEMA) as Record<string, unknown>;

export type ScrapePricingResult =
    | {
          success: true;
          pricingSchema: PricingSchema;
          /** Firecrawl changeTracking verdict; 'same' → caller may skip diff/AI. */
          changeStatus?: "new" | "same" | "changed" | "removed";
          markdown?: string;
          /** Firecrawl-hosted screenshot URL (when captureScreenshot). Push to R2 via fetchScreenshotBuffer. */
          screenshotUrl?: string;
      }
    | {
          success: false;
          error: string;
          code: "TIMEOUT" | "BLOCKED" | "NO_PRICING" | "PARSE" | "UNKNOWN";
      };

/** P1 gate. Callers run the Firecrawl extractor only when explicitly enabled. */
export function isFirecrawlExtractorEnabled(): boolean {
    return process.env.FIRECRAWL_EXTRACTOR === "1";
}

const ENTERPRISE_RE = /contact|custom|talk to sales|get a quote/i;

/** Map Firecrawl's flat extraction → canonical PricingSchema (adds id/position/price_visible). */
export function toPricingSchema(extracted: ExtractedPricing): PricingSchema {
    const plans: PricingPlan[] = extracted.plans.map((p, idx) => ({
        id: `plan-${idx}`,
        name: p.name,
        position: idx,
        price_raw: p.price_raw,
        price_visible: !!p.price_raw && !ENTERPRISE_RE.test(p.price_raw),
        billing: p.billing,
        cta: p.cta,
        badges: p.badges,
        limits: p.limits,
        features: p.features,
    }));

    const highlighted =
        extracted.highlighted_plan ??
        extracted.plans.find((p) => p.is_highlighted)?.name ??
        null;

    return {
        currency: extracted.currency,
        plans,
        has_free_tier: extracted.has_free_tier,
        highlighted_plan: highlighted,
    };
}

/**
 * Scrape a pricing page and return a canonical PricingSchema.
 *
 * @param url - pricing page URL
 * @param context - optional geo context → real Firecrawl proxy exit (`location.country`)
 * @param trackChanges - include changeTracking(json) as a cheap unchanged-page pre-filter
 * @param captureScreenshot - also request a full-page screenshot (extra Firecrawl cost); URL in result.screenshotUrl
 */
export async function scrapePricing(
    url: string,
    context?: PricingContext,
    trackChanges = false,
    captureScreenshot = false
): Promise<ScrapePricingResult> {
    try {
        const client = getFirecrawlClient();

        const formats: FormatOption[] = [
            "markdown",
            { type: "json", schema: PRICING_JSON_SCHEMA },
        ];
        if (trackChanges) {
            formats.push({
                type: "changeTracking",
                modes: ["json"],
                schema: PRICING_JSON_SCHEMA,
            });
        }
        if (captureScreenshot) {
            formats.push({ type: "screenshot", fullPage: true });
        }

        const options: ScrapeOptions = {
            formats,
            proxy: "auto",
            maxAge: 600_000,
            onlyMainContent: false,
        };
        if (context?.country != null) {
            options.location = { country: context.country, languages: [context.locale] };
        }

        const scrapePromise = client.scrape(url, options);

        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT_MS);
        });

        const result = (await Promise.race([scrapePromise, timeoutPromise])) as {
            json?: unknown;
            markdown?: string;
            changeTracking?: { changeStatus?: "new" | "same" | "changed" | "removed" };
            screenshot?: string;
        };

        const parsed = PRICING_SCHEMA.safeParse(result?.json);
        if (!parsed.success) {
            return { success: false, error: "Firecrawl json did not match pricing schema", code: "PARSE" };
        }
        if (parsed.data.plans.length === 0) {
            return { success: false, error: "No pricing plans detected", code: "NO_PRICING" };
        }

        return {
            success: true,
            pricingSchema: toPricingSchema(parsed.data),
            changeStatus: result.changeTracking?.changeStatus,
            markdown: result.markdown,
            screenshotUrl: result.screenshot,
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message === "TIMEOUT") return { success: false, error: "Scrape timed out", code: "TIMEOUT" };
        if (/403|blocked/i.test(message)) return { success: false, error: "Blocked by bot protection", code: "BLOCKED" };
        return { success: false, error: message, code: "UNKNOWN" };
    }
}

/**
 * Fetch a Firecrawl-hosted screenshot URL into a Buffer for R2 upload.
 *
 * Firecrawl returns the screenshot as a temporary URL, not bytes; R2's
 * uploadScreenshot() takes a Buffer. This is the only glue between them, so the
 * pipeline can do: uploadScreenshot(id, key, await fetchScreenshotBuffer(url)).
 *
 * ponytail: Firecrawl serves PNG/JPEG; screenshotStorage still labels .webp —
 * cosmetic content-type mismatch, fix when the live pipeline cuts over (P3).
 */
export async function fetchScreenshotBuffer(url: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Screenshot fetch failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
}
