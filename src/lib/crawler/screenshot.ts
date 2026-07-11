import { getFirecrawlClient } from "./firecrawl";
import { fetchScreenshotBuffer } from "./scrapePage";

/**
 * Screenshot Capture Module (Firecrawl-hosted — P3b, Playwright removed)
 *
 * Captures full-page screenshots of competitor pages via Firecrawl.
 * Screenshots are then analyzed by Gemini vision for structured data extraction.
 */

export interface ScreenshotResult {
    success: true;
    screenshot: Buffer;
    /** image/png or image/jpeg — Gemini needs the real mime type */
    contentType: string;
    url: string;
    title: string;
    timestamp: string;
}

export interface ScreenshotError {
    success: false;
    error: string;
    code: "TIMEOUT" | "BLOCKED" | "UNKNOWN";
}

export type ScreenshotResponse = ScreenshotResult | ScreenshotError;

function sniffContentType(buf: Buffer): string {
    if (buf.length > 2 && buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
    if (buf.length > 2 && buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
    return "image/png";
}

/**
 * Capture a full-page screenshot of a URL via Firecrawl
 */
export async function captureScreenshot(url: string): Promise<ScreenshotResponse> {
    try {
        const firecrawl = getFirecrawlClient();
        const doc = await firecrawl.scrape(url, {
            formats: [{ type: "screenshot", fullPage: true }],
            onlyMainContent: false,
            timeout: 60000,
        });

        if (!doc.screenshot) {
            return { success: false, error: "Firecrawl returned no screenshot", code: "UNKNOWN" };
        }

        const screenshot = await fetchScreenshotBuffer(doc.screenshot);
        console.log(`[Screenshot] Captured ${screenshot.length} bytes via Firecrawl`);

        return {
            success: true,
            screenshot,
            contentType: sniffContentType(screenshot),
            url,
            title: doc.metadata?.title || "",
            timestamp: new Date().toISOString(),
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (/timeout/i.test(message)) {
            return { success: false, error: "Page load timed out", code: "TIMEOUT" };
        }
        if (message.includes("403") || /blocked/i.test(message)) {
            return { success: false, error: "Page blocked our request", code: "BLOCKED" };
        }
        return { success: false, error: message, code: "UNKNOWN" };
    }
}
