import type { PricingContext, PricingSnapshot } from "@/lib/types";

/**
 * Smart Scraper Selection Logic
 *
 * Decides whether to use Firecrawl (cheap, fast) or Playwright (expensive, accurate)
 * based on context requirements and historical success.
 */

export type ScraperType = "firecrawl" | "playwright";

interface DecideScraperOptions {
    context: PricingContext;
    lastSnapshot: PricingSnapshot | null;
    competitorBestScraper?: ScraperType | null;
}

/**
 * Decide which scraper to use for a given context.
 *
 * Decision priority:
 * 1. If context requires browser (geo-aware) → Playwright
 * 2. If no previous snapshot → Firecrawl (try cheap first)
 * 3. If previous used Playwright successfully → Playwright
 * 4. If competitor has proven best scraper → use that
 * 5. Default → Firecrawl
 */
export function decideScraper(options: DecideScraperOptions): ScraperType {
    const { context, lastSnapshot, competitorBestScraper } = options;

    // Rule 1: Geo-aware contexts require Playwright for locale/timezone
    if (context.requires_browser) {
        return "playwright";
    }

    // Rule 2: No previous snapshot - try Firecrawl first (cheaper)
    if (!lastSnapshot) {
        return "firecrawl";
    }

    // Rule 3: If previous Playwright was successful, stick with it
    if (lastSnapshot.source === "playwright") {
        return "playwright";
    }

    // Rule 4: Use proven best scraper for this competitor
    if (competitorBestScraper) {
        return competitorBestScraper;
    }

    // Rule 5: Default to Firecrawl (cheap)
    return "firecrawl";
}

/**
 * Check if Firecrawl is available (API key configured).
 */
export function isFirecrawlAvailable(): boolean {
    return !!process.env.FIRECRAWL_API_KEY;
}

/**
 * Determine if we should upgrade to Playwright based on Firecrawl result.
 *
 * Upgrade triggers:
 * - Content too short (< 500 chars)
 * - No pricing numbers detected
 * - Currency mismatch with expected region
 */
export function shouldUpgradeToPlaywright(
    firecrawlContent: string,
    expectedCurrencySymbols: string[]
): boolean {
    // Content too short
    if (firecrawlContent.length < 500) {
        return true;
    }

    // No pricing numbers detected
    const hasPricingNumbers = /\$[\d,]+|€[\d,]+|₹[\d,]+|£[\d,]+|\d+\s*\/\s*(mo|month|year|yr)/i.test(
        firecrawlContent
    );
    if (!hasPricingNumbers) {
        return true;
    }

    // Check if expected currency symbols are present
    const hasCurrency = expectedCurrencySymbols.some((symbol) =>
        firecrawlContent.includes(symbol)
    );
    if (!hasCurrency) {
        return true;
    }

    return false;
}

/**
 * Mark a scraper as proven best for a competitor.
 * Called after successful consecutive runs.
 */
export function determinebestScraper(
    snapshots: PricingSnapshot[],
    minConsecutive = 2
): ScraperType | null {
    if (snapshots.length < minConsecutive) {
        return null;
    }

    const recentSnapshots = snapshots.slice(0, minConsecutive);
    const allSameScraper = recentSnapshots.every(
        (s) => s.source === recentSnapshots[0].source
    );

    if (allSameScraper) {
        return recentSnapshots[0].source;
    }

    return null;
}
