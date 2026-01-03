import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { GoogleGenAI } from "@google/genai";
import type { PricingContext, PricingPlan } from "@/lib/types";
import { getGeoContextConfig } from "./geoContext";

/**
 * Vision-Based Pricing Extractor
 *
 * Strategy: Playwright screenshot → Gemini Vision analysis
 * 
 * Why this approach:
 * - DOM parsing fails on JS-heavy CSR pricing pages
 * - Vision AI can "read" the page like a human
 * - Works regardless of framework or rendering method
 */

// ──────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ──────────────────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 30000;
const SCREENSHOT_QUALITY = 85;

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

export async function closeVisionBrowser(): Promise<void> {
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// RESULT TYPES
// ──────────────────────────────────────────────────────────────────────────────

export interface ExtractedPricing {
    currency: string;
    currencySymbol: string;
    plans: ExtractedPlan[];
    hasFreeTier: boolean;
    billingOptions: ("monthly" | "yearly" | "one-time")[];
    promotions: string[];
    confidence: "high" | "medium" | "low";
}

export interface ExtractedPlan {
    name: string;
    price: string;           // "$49" or "Free"
    priceNumeric: number | null;  // 49 or null
    period: string;          // "month", "year", "one-time"
    credits?: string;        // "500 credits" if applicable
    features: string[];
    isHighlighted: boolean;
    isFree: boolean;
    isEnterprise: boolean;  // "Contact us" plans
}

export interface VisionPricingResult {
    success: true;
    pricing: ExtractedPricing;
    screenshot: Buffer;
    region: string;
    rawAnalysis: string;
}

export interface VisionPricingError {
    success: false;
    error: string;
    code: "TIMEOUT" | "BLOCKED" | "AI_ERROR" | "NO_PRICING" | "UNKNOWN";
}

export type VisionPricingResponse = VisionPricingResult | VisionPricingError;

// ──────────────────────────────────────────────────────────────────────────────
// GEMINI VISION PROMPT
// ──────────────────────────────────────────────────────────────────────────────

const PRICING_EXTRACTION_PROMPT = `You are a pricing extraction specialist. Analyze this screenshot of a pricing page and extract ALL pricing information.

IMPORTANT: Read the EXACT prices shown on screen. Do not guess or make up prices.

Return JSON in this exact format:
{
  "currency": "USD",
  "currencySymbol": "$",
  "plans": [
    {
      "name": "Free",
      "price": "Free",
      "priceNumeric": 0,
      "period": "month",
      "credits": "500 credits",
      "features": ["Feature 1", "Feature 2"],
      "isHighlighted": false,
      "isFree": true,
      "isEnterprise": false
    },
    {
      "name": "Pro",
      "price": "$49",
      "priceNumeric": 49,
      "period": "month",
      "credits": null,
      "features": ["All Free features", "Feature 3"],
      "isHighlighted": true,
      "isFree": false,
      "isEnterprise": false
    }
  ],
  "hasFreeTier": true,
  "billingOptions": ["monthly", "yearly"],
  "promotions": ["20% off annual"],
  "confidence": "high"
}

RULES:
1. Extract EVERY visible plan (Free, Basic, Pro, Enterprise, etc.)
2. price should be the exact displayed amount ("$49", "€29", "₹1,999", "Free")
3. priceNumeric should be the number only (49, 29, 1999, 0 for free, null for "Contact us")
4. period: "month", "year", or "one-time"
5. isEnterprise: true if price says "Contact us", "Custom", "Talk to sales"
6. isHighlighted: true if plan has "Popular", "Recommended", or special styling
7. billingOptions: which billing periods are available
8. confidence: "high" if pricing is clear, "medium" if some guessing, "low" if very unclear

Return ONLY valid JSON, no markdown blocks.`;

// ──────────────────────────────────────────────────────────────────────────────
// MAIN EXTRACTION FUNCTION
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Extract pricing from a page using Playwright screenshot + Gemini Vision.
 * 
 * @param url - The pricing page URL
 * @param context - Optional geo context for regional pricing
 */
export async function extractPricingWithVision(
    url: string,
    context?: PricingContext
): Promise<VisionPricingResponse> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return {
            success: false,
            error: "GEMINI_API_KEY not configured",
            code: "AI_ERROR",
        };
    }

    let browserContext: BrowserContext | null = null;
    let page: Page | null = null;

    try {
        const browser = await getBrowser();

        // Apply geo configuration if provided
        const geoConfig = context ? getGeoContextConfig(context) : {};
        browserContext = await browser.newContext({
            ...geoConfig,
            viewport: { width: 1440, height: 900 },
        });

        page = await browserContext.newPage();

        // Navigate to pricing page
        console.log(`[VisionPricing] Navigating to: ${url}`);
        await page.goto(url, {
            timeout: TIMEOUT_MS,
            waitUntil: "networkidle",
        });

        // Wait for JS rendering
        await page.waitForTimeout(3000);

        // Scroll to trigger lazy content, then back to top
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight / 3);
        });
        await page.waitForTimeout(1000);
        await page.evaluate(() => {
            window.scrollTo(0, 0);
        });
        await page.waitForTimeout(500);

        // Capture screenshot
        const screenshot = await page.screenshot({
            type: "jpeg",
            quality: SCREENSHOT_QUALITY,
            fullPage: true,
        });

        console.log(`[VisionPricing] Captured ${screenshot.length} bytes`);

        // Compress if needed
        const compressedScreenshot = await compressScreenshot(screenshot);

        // Close browser resources
        await page.close();
        await browserContext.close();
        page = null;
        browserContext = null;

        // Analyze with Gemini Vision
        const ai = new GoogleGenAI({ apiKey });
        const base64Image = compressedScreenshot.toString("base64");

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            inlineData: {
                                mimeType: "image/jpeg",
                                data: base64Image,
                            },
                        },
                        {
                            text: PRICING_EXTRACTION_PROMPT,
                        },
                    ],
                },
            ],
            config: {
                maxOutputTokens: 4000,
                temperature: 0.1, // Low temperature for accuracy
            },
        });

        const rawText = response.text || "";

        if (!rawText) {
            return {
                success: false,
                error: "Gemini returned empty response",
                code: "AI_ERROR",
            };
        }

        // Parse JSON from response
        let pricing: ExtractedPricing;
        try {
            const cleanedText = rawText
                .replace(/```json\n?/g, "")
                .replace(/```\n?/g, "")
                .trim();

            pricing = JSON.parse(cleanedText);
        } catch {
            console.error("[VisionPricing] Failed to parse JSON:", rawText.slice(0, 500));
            return {
                success: false,
                error: "Failed to parse pricing data from AI response",
                code: "AI_ERROR",
            };
        }

        // Validate we got actual pricing
        if (!pricing.plans || pricing.plans.length === 0) {
            return {
                success: false,
                error: "No pricing plans detected in screenshot",
                code: "NO_PRICING",
            };
        }

        return {
            success: true,
            pricing,
            screenshot: compressedScreenshot,
            region: context?.key || "global",
            rawAnalysis: rawText,
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
// MULTI-REGION EXTRACTION
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Extract pricing from multiple regions to detect geo-pricing.
 */
export async function extractPricingMultiRegion(
    url: string,
    contexts: PricingContext[]
): Promise<Map<string, VisionPricingResponse>> {
    const results = new Map<string, VisionPricingResponse>();

    for (const context of contexts) {
        console.log(`[VisionPricing] Extracting from region: ${context.key}`);
        const result = await extractPricingWithVision(url, context);
        results.set(context.key, result);

        // Small delay between regions to avoid rate limiting
        await new Promise((r) => setTimeout(r, 1000));
    }

    return results;
}

// ──────────────────────────────────────────────────────────────────────────────
// IMAGE COMPRESSION
// ──────────────────────────────────────────────────────────────────────────────

async function compressScreenshot(buffer: Buffer): Promise<Buffer> {
    try {
        const sharp = (await import("sharp")).default;

        const metadata = await sharp(buffer).metadata();
        const width = metadata.width || 1440;

        const compressed = await sharp(buffer)
            .resize({
                width: Math.min(width, 1200),
                withoutEnlargement: true,
            })
            .jpeg({
                quality: 75,
                mozjpeg: true,
            })
            .toBuffer();

        const savings = Math.round((1 - compressed.length / buffer.length) * 100);
        console.log(`[VisionPricing] Compressed ${buffer.length} → ${compressed.length} bytes (${savings}% smaller)`);

        return compressed;
    } catch (error) {
        console.warn("[VisionPricing] Compression failed, using original:", error);
        return buffer;
    }
}
