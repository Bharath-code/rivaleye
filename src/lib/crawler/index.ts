import type { CrawlResponse, CrawlResult, CrawlError } from "@/lib/types";
import { fetchPage as fetchFirecrawl } from "./firecrawl";
import { fetchPageCheerio } from "./cheerio";
import { fetchPagePlaywright } from "./playwright";

/**
 * Unified Crawler Orchestrator
 *
 * Tiered fallback system:
 * 1. Firecrawl (best quality, costs $$$)
 * 2. Cheerio (free, no JS)
 * 3. Playwright (free, full JS)
 */

type CrawlerSource = "firecrawl" | "cheerio" | "playwright";

type ExtendedCrawlResult = CrawlResult & { source: CrawlerSource };
type ExtendedCrawlError = CrawlError & { source?: CrawlerSource };
type ExtendedCrawlResponse = ExtendedCrawlResult | ExtendedCrawlError;

/**
 * Check if Firecrawl is available (API key configured)
 */
function isFirecrawlAvailable(): boolean {
    return !!process.env.FIRECRAWL_API_KEY;
}

/**
 * Fetch page with automatic fallback cascade
 */
export async function fetchPageWithFallback(
    url: string,
    options: { skipFirecrawl?: boolean } = {}
): Promise<ExtendedCrawlResponse> {
    const results: { source: CrawlerSource; result: CrawlResponse }[] = [];

    // Tier 1: Firecrawl (if available and not skipped)
    if (isFirecrawlAvailable() && !options.skipFirecrawl) {
        console.log(`[Crawler] Trying Firecrawl for: ${url}`);
        const result = await fetchFirecrawl(url);

        if (result.success) {
            return { ...result, source: "firecrawl" };
        }

        results.push({ source: "firecrawl", result });
        console.log(`[Crawler] Firecrawl failed: ${result.error}, falling back...`);
    }

    // Tier 2: Cheerio (lightweight, no JS)
    console.log(`[Crawler] Trying Cheerio for: ${url}`);
    const cheerioResult = await fetchPageCheerio(url);

    if (cheerioResult.success) {
        return { ...cheerioResult, source: "cheerio" };
    }

    results.push({ source: "cheerio", result: cheerioResult });
    console.log(`[Crawler] Cheerio failed: ${cheerioResult.error}, falling back to Playwright...`);

    // Tier 3: Playwright (full browser, JS execution)
    console.log(`[Crawler] Trying Playwright for: ${url}`);
    const playwrightResult = await fetchPagePlaywright(url);

    if (playwrightResult.success) {
        return { ...playwrightResult, source: "playwright" };
    }

    results.push({ source: "playwright", result: playwrightResult });

    // All failed — return the most informative error
    const lastError = results[results.length - 1]?.result;
    if (lastError && !lastError.success) {
        return { ...lastError, source: "playwright" };
    }

    return {
        success: false,
        error: "All crawlers failed",
        code: "UNKNOWN",
        source: "playwright",
    };
}

/**
 * Retry wrapper for fetchPageWithFallback
 */
export async function fetchPageWithRetry(
    url: string,
    maxRetries = 2
): Promise<ExtendedCrawlResponse> {
    let lastResult: ExtendedCrawlResponse | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const result = await fetchPageWithFallback(url);

        if (result.success) {
            return result;
        }

        lastResult = result;

        // Don't retry if blocked or empty — won't change
        if (result.code === "BLOCKED" || result.code === "EMPTY") {
            break;
        }

        // Wait before retry
        if (attempt < maxRetries - 1) {
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
    }

    return (
        lastResult || {
            success: false,
            error: "All retry attempts failed",
            code: "UNKNOWN",
        }
    );
}

// Re-export for convenience
export { fetchPageCheerio } from "./cheerio";
export { fetchPagePlaywright, closeBrowser } from "./playwright";
