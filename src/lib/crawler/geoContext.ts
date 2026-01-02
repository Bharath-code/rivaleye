import type { PricingContext } from "@/lib/types";
import type { BrowserContextOptions } from "playwright";

/**
 * Geo-Context Configuration for Playwright
 *
 * Configures browser context to simulate visitors from different regions.
 * This affects locale, timezone, geolocation, and Accept-Language headers.
 *
 * Note: IP-based geo detection still requires proxies (future enhancement).
 */

// ──────────────────────────────────────────────────────────────────────────────
// GEOLOCATION COORDINATES BY REGION
// ──────────────────────────────────────────────────────────────────────────────

const GEO_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
    us: { latitude: 40.7128, longitude: -74.006 },    // New York City
    in: { latitude: 19.076, longitude: 72.8777 },     // Mumbai
    eu: { latitude: 52.52, longitude: 13.405 },       // Berlin
    global: { latitude: 0, longitude: 0 },            // Null Island (neutral)
};

// ──────────────────────────────────────────────────────────────────────────────
// USER AGENTS BY REGION
// ──────────────────────────────────────────────────────────────────────────────

const USER_AGENTS: Record<string, string> = {
    us: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    in: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    eu: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    global: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

// ──────────────────────────────────────────────────────────────────────────────
// MAIN CONFIG GENERATOR
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Generate Playwright browser context configuration for a pricing context.
 * Simulates a visitor from the specified region.
 */
export function getGeoContextConfig(context: PricingContext): BrowserContextOptions {
    const coords = GEO_COORDINATES[context.key] || GEO_COORDINATES.global;

    return {
        locale: context.locale,
        timezoneId: context.timezone,
        geolocation: coords,
        permissions: ["geolocation"],
        userAgent: USER_AGENTS[context.key] || USER_AGENTS.global,
        extraHTTPHeaders: {
            "Accept-Language": getAcceptLanguage(context.key),
        },
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
    };
}

/**
 * Generate Accept-Language header based on region.
 */
function getAcceptLanguage(contextKey: string): string {
    const headers: Record<string, string> = {
        us: "en-US,en;q=0.9",
        in: "en-IN,en;q=0.9,hi;q=0.8",
        eu: "en-DE,en;q=0.9,de;q=0.8",
        global: "en-US,en;q=0.9",
    };
    return headers[contextKey] || headers.global;
}

/**
 * Get currency symbol expected for a region.
 * Used for validation after scraping.
 */
export function getExpectedCurrency(contextKey: string): string {
    const currencies: Record<string, string> = {
        us: "USD",
        in: "INR",
        eu: "EUR",
        global: "USD",
    };
    return currencies[contextKey] || "USD";
}

/**
 * Get currency symbols for regex matching.
 */
export function getCurrencySymbols(contextKey: string): string[] {
    const symbols: Record<string, string[]> = {
        us: ["$", "USD"],
        in: ["₹", "INR", "Rs"],
        eu: ["€", "EUR"],
        global: ["$", "€", "₹", "£"],
    };
    return symbols[contextKey] || symbols.global;
}
