/**
 * Exchange Rate Service
 *
 * Fetches real-time exchange rates from exchangerate.host (free, no API key).
 * Includes caching to minimize API calls.
 */

// ──────────────────────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────────────────────

interface ExchangeRates {
    base: string;
    date: string;
    rates: Record<string, number>;
    timestamp: number; // When we fetched it
}

interface CachedRates {
    rates: Record<string, number>;
    fetchedAt: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ──────────────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const BASE_CURRENCY = "USD";

// In-memory cache
let ratesCache: CachedRates | null = null;

// Fallback rates if API fails
const FALLBACK_RATES: Record<string, number> = {
    USD: 1,
    EUR: 0.92,
    INR: 83.5,
    GBP: 0.79,
    JPY: 157.0,
    AUD: 1.54,
    CAD: 1.36,
    BRL: 4.97,
};

// ──────────────────────────────────────────────────────────────────────────────
// MAIN FUNCTIONS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Fetch exchange rates from API or cache
 */
export async function getExchangeRates(): Promise<Record<string, number>> {
    // Check cache
    if (ratesCache && Date.now() - ratesCache.fetchedAt < CACHE_TTL_MS) {
        return ratesCache.rates;
    }

    try {
        // Fetch fresh rates from exchangerate.host (free, no key required)
        const response = await fetch(
            `https://api.exchangerate.host/latest?base=${BASE_CURRENCY}`
        );

        if (!response.ok) {
            console.warn("Exchange rate API error, using fallback rates");
            return FALLBACK_RATES;
        }

        const data: ExchangeRates = await response.json();

        // Cache the rates
        ratesCache = {
            rates: data.rates,
            fetchedAt: Date.now(),
        };

        return data.rates;
    } catch (error) {
        console.warn("Failed to fetch exchange rates, using fallback:", error);
        return FALLBACK_RATES;
    }
}

/**
 * Convert price to USD
 */
export async function convertToUsd(
    amount: number,
    fromCurrency: string
): Promise<number> {
    if (fromCurrency === "USD") return amount;

    const rates = await getExchangeRates();
    const rate = rates[fromCurrency];

    if (!rate) {
        console.warn(`Unknown currency: ${fromCurrency}, assuming USD`);
        return amount;
    }

    // Rate is X currency per 1 USD, so we divide
    return amount / rate;
}

/**
 * Get the exchange rate for a currency to USD
 */
export async function getRateToUsd(currency: string): Promise<number> {
    if (currency === "USD") return 1;

    const rates = await getExchangeRates();
    const rate = rates[currency];

    if (!rate) {
        console.warn(`Unknown currency: ${currency}, returning 1`);
        return 1;
    }

    // Rate is X currency per 1 USD, so 1/rate gives us multiplier to USD
    return 1 / rate;
}

/**
 * Clear the cache (useful for testing)
 */
export function clearRatesCache(): void {
    ratesCache = null;
}
