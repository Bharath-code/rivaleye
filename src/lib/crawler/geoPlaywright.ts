import { chromium, type Browser, type Page, type BrowserContext } from "playwright";
import type { PricingContext, PricingSchema, PricingPlan } from "@/lib/types";
import { getGeoContextConfig, getCurrencySymbols } from "./geoContext";
import { createHash } from "crypto";

/**
 * Geo-Aware Playwright Scraper
 *
 * Captures pricing pages with region-specific browser configuration.
 * Includes cost optimizations: resource blocking, section screenshots.
 */

// ──────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ──────────────────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 30000;
const SCREENSHOT_QUALITY = 80;

// Resources to block for faster page loads
const BLOCKED_RESOURCE_TYPES = ["image", "font", "media", "stylesheet"];
const BLOCKED_URL_PATTERNS = [
    "**/analytics**",
    "**/tracking**",
    "**/ads**",
    "**/pixel**",
    "**/gtm**",
    "**/facebook**",
    "**/twitter**",
    "**/linkedin**",
];

// ──────────────────────────────────────────────────────────────────────────────
// BROWSER MANAGEMENT
// ──────────────────────────────────────────────────────────────────────────────

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
    if (!browserInstance || !browserInstance.isConnected()) {
        browserInstance = await chromium.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        });
    }
    return browserInstance;
}

export async function closeGeoBrowser(): Promise<void> {
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// SCRAPING RESULT TYPES
// ──────────────────────────────────────────────────────────────────────────────

export interface GeoScrapeResult {
    success: true;
    pricingSchema: PricingSchema;
    screenshot: Buffer;
    domHash: string;
    currencyDetected: string | null;
    rawHtml: string;
}

export interface GeoScrapeError {
    success: false;
    error: string;
    code: "TIMEOUT" | "BLOCKED" | "EMPTY" | "UNKNOWN";
}

export type GeoScrapeResponse = GeoScrapeResult | GeoScrapeError;

// ──────────────────────────────────────────────────────────────────────────────
// MAIN SCRAPING FUNCTION
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Scrape a pricing page with geo-context configuration.
 * Returns structured pricing schema and screenshot.
 */
export async function scrapeWithGeoContext(
    url: string,
    context: PricingContext
): Promise<GeoScrapeResponse> {
    let browserContext: BrowserContext | null = null;
    let page: Page | null = null;

    try {
        const browser = await getBrowser();
        const geoConfig = getGeoContextConfig(context);

        // Create context with geo configuration
        browserContext = await browser.newContext(geoConfig);
        page = await browserContext.newPage();

        // Block heavy resources for speed (cost optimization)
        await page.route("**/*", (route) => {
            const resourceType = route.request().resourceType();
            const url = route.request().url();

            // Block heavy resources
            if (BLOCKED_RESOURCE_TYPES.includes(resourceType)) {
                return route.abort();
            }

            // Block tracking scripts
            if (BLOCKED_URL_PATTERNS.some((pattern) => url.includes(pattern.replace(/\*/g, "")))) {
                return route.abort();
            }

            return route.continue();
        });

        // Navigate with timeout
        await page.goto(url, {
            timeout: TIMEOUT_MS,
            waitUntil: "domcontentloaded", // Faster than networkidle
        });

        // Wait for pricing content to render
        await page.waitForTimeout(2000);

        // Scroll to trigger lazy-loaded content
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight / 2);
        });
        await page.waitForTimeout(1000);

        // Extract pricing schema
        const pricingSchema = await extractPricingSchema(page, context);

        // Take screenshot of pricing section only (cost optimization)
        const screenshot = await capturePricingScreenshot(page);

        // Get DOM hash for change detection
        const rawHtml = await page.content();
        const domHash = createHash("sha256").update(rawHtml).digest("hex").slice(0, 16);

        // Detect currency from page
        const currencyDetected = await detectCurrency(page, context);

        // Cleanup
        await page.close();
        await browserContext.close();

        if (pricingSchema.plans.length === 0) {
            return {
                success: false,
                error: "No pricing plans detected",
                code: "EMPTY",
            };
        }

        return {
            success: true,
            pricingSchema,
            screenshot,
            domHash,
            currencyDetected,
            rawHtml,
        };
    } catch (error: unknown) {
        // Cleanup on error
        if (page) await page.close().catch(() => { });
        if (browserContext) await browserContext.close().catch(() => { });

        if (error instanceof Error) {
            if (error.message.includes("Timeout")) {
                return { success: false, error: "Page load timed out", code: "TIMEOUT" };
            }
            if (error.message.includes("403") || error.message.includes("blocked")) {
                return { success: false, error: "Page blocked our request", code: "BLOCKED" };
            }
            return { success: false, error: error.message, code: "UNKNOWN" };
        }

        return { success: false, error: "Unknown error", code: "UNKNOWN" };
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// PRICING SCHEMA EXTRACTION
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Extract structured pricing schema from page DOM.
 */
async function extractPricingSchema(page: Page, context: PricingContext): Promise<PricingSchema> {
    const currencySymbols = getCurrencySymbols(context.key);

    return page.evaluate(
        ({ symbols }) => {
            const plans: PricingPlan[] = [];

            // Common pricing card selectors
            const cardSelectors = [
                "[class*='pricing-card']",
                "[class*='plan-card']",
                "[class*='price-card']",
                "[class*='tier']",
                "[data-plan]",
                "[data-pricing]",
                ".pricing-table > div",
                ".pricing-cards > div",
            ];

            // Try each selector
            for (const selector of cardSelectors) {
                const cards = document.querySelectorAll(selector);
                if (cards.length >= 2) {
                    // Found pricing cards
                    cards.forEach((card, index) => {
                        const plan = extractPlanFromCard(card as HTMLElement, index, symbols);
                        if (plan) plans.push(plan);
                    });
                    break;
                }
            }

            // Fallback: find all elements with price patterns
            if (plans.length === 0) {
                const priceRegex = new RegExp(`[${symbols.join("")}]\\s*[\\d,]+`, "g");
                const allText = document.body.innerText;
                const priceMatches = allText.match(priceRegex) || [];

                // Create basic plans from detected prices
                priceMatches.slice(0, 5).forEach((price, index) => {
                    plans.push({
                        id: `plan-${index}`,
                        name: `Plan ${index + 1}`,
                        position: index,
                        price_raw: price,
                        price_visible: true,
                        billing: "unknown",
                        cta: "",
                        badges: [],
                        limits: {},
                        features: [],
                    });
                });
            }

            // Detect highlighted plan
            const highlightedPlan = plans.find(
                (p) =>
                    p.badges.some((b) =>
                        /popular|recommended|best|featured/i.test(b)
                    ) || p.position === 1 // Middle plan often highlighted
            );

            // Detect free tier
            const hasFreeTier = plans.some(
                (p) =>
                    /free|$0|€0|₹0/i.test(p.price_raw || "") ||
                    /free/i.test(p.name)
            );

            // Detect currency
            const detectedCurrency =
                symbols.find((s) => plans.some((p) => p.price_raw?.includes(s))) ||
                "USD";

            return {
                currency: detectedCurrency,
                plans,
                has_free_tier: hasFreeTier,
                highlighted_plan: highlightedPlan?.id || null,
            };

            // Helper function inside evaluate
            function extractPlanFromCard(
                card: HTMLElement,
                index: number,
                currencySymbols: string[]
            ): PricingPlan | null {
                const text = card.innerText || "";

                // Skip if too short
                if (text.length < 20) return null;

                // Extract plan name (usually h2, h3, or first strong text)
                const nameEl =
                    card.querySelector("h2, h3, h4, [class*='name'], [class*='title']");
                const name = nameEl?.textContent?.trim() || `Plan ${index + 1}`;

                // Extract price
                const priceRegex = new RegExp(
                    `[${currencySymbols.join("")}]\\s*[\\d,]+(?:\\.\\d{2})?`,
                    "g"
                );
                const priceMatches = text.match(priceRegex) || [];
                const priceRaw = priceMatches[0] || null;

                // Detect billing period
                let billing: "monthly" | "yearly" | "one-time" | "unknown" = "unknown";
                if (/\/mo|month|monthly/i.test(text)) billing = "monthly";
                else if (/\/yr|year|annual/i.test(text)) billing = "yearly";
                else if (/one.?time|lifetime/i.test(text)) billing = "one-time";

                // Extract CTA
                const ctaEl = card.querySelector(
                    "button, a[class*='cta'], a[class*='button'], [class*='action']"
                );
                const cta = ctaEl?.textContent?.trim() || "";

                // Extract badges
                const badges: string[] = [];
                const badgeEls = card.querySelectorAll(
                    "[class*='badge'], [class*='tag'], [class*='popular'], [class*='recommended']"
                );
                badgeEls.forEach((el) => {
                    const badgeText = el.textContent?.trim();
                    if (badgeText) badges.push(badgeText);
                });

                // Extract features (list items)
                const features: string[] = [];
                card.querySelectorAll("li, [class*='feature']").forEach((el) => {
                    const featureText = el.textContent?.trim();
                    if (featureText && featureText.length < 100) {
                        features.push(featureText);
                    }
                });

                return {
                    id: `plan-${index}`,
                    name,
                    position: index,
                    price_raw: priceRaw,
                    price_visible: !!priceRaw,
                    billing,
                    cta,
                    badges,
                    limits: {},
                    features: features.slice(0, 10),
                };
            }
        },
        { symbols: currencySymbols }
    ) as Promise<PricingSchema>;
}

// ──────────────────────────────────────────────────────────────────────────────
// SCREENSHOT CAPTURE
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Capture screenshot of pricing section only.
 * Cost optimization: smaller images, faster uploads.
 */
async function capturePricingScreenshot(page: Page): Promise<Buffer> {
    // Try to find pricing section
    const pricingSelectors = [
        "#pricing",
        "[id*='pricing']",
        "[class*='pricing']",
        "[data-section='pricing']",
        "section:has([class*='price'])",
    ];

    for (const selector of pricingSelectors) {
        try {
            const element = page.locator(selector).first();
            if (await element.isVisible({ timeout: 1000 })) {
                return await element.screenshot({
                    type: "jpeg",
                    quality: SCREENSHOT_QUALITY,
                });
            }
        } catch {
            // Not found, continue
        }
    }

    // Fallback: full page screenshot
    return await page.screenshot({
        type: "jpeg",
        quality: SCREENSHOT_QUALITY,
        fullPage: true,
    });
}

// ──────────────────────────────────────────────────────────────────────────────
// CURRENCY DETECTION
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Detect currency displayed on page.
 */
async function detectCurrency(page: Page, context: PricingContext): Promise<string | null> {
    const expectedSymbols = getCurrencySymbols(context.key);

    return page.evaluate((symbols) => {
        const text = document.body.innerText;

        // Check for each expected symbol
        for (const symbol of symbols) {
            if (text.includes(symbol)) {
                // Return standardized currency code
                const currencyMap: Record<string, string> = {
                    $: "USD",
                    "€": "EUR",
                    "₹": "INR",
                    Rs: "INR",
                    "£": "GBP",
                    USD: "USD",
                    EUR: "EUR",
                    INR: "INR",
                };
                return currencyMap[symbol] || symbol;
            }
        }

        return null;
    }, expectedSymbols);
}
