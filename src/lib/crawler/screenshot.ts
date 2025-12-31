import { chromium, type Browser, type Page } from "playwright";

/**
 * Screenshot Capture Module
 *
 * Captures full-page screenshots of competitor pages using Playwright.
 * Screenshots are then analyzed by Gemini vision for structured data extraction.
 */

const TIMEOUT_MS = 30000;

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
    if (!browserInstance || !browserInstance.isConnected()) {
        browserInstance = await chromium.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
    }
    return browserInstance;
}

export interface ScreenshotResult {
    success: true;
    screenshot: Buffer;
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

/**
 * Capture a full-page screenshot of a URL
 */
export async function captureScreenshot(url: string): Promise<ScreenshotResponse> {
    let page: Page | null = null;

    try {
        const browser = await getBrowser();
        page = await browser.newPage();

        // Set realistic viewport (pricing pages need width for full tables)
        await page.setViewportSize({ width: 1440, height: 900 });

        // Navigate with timeout
        console.log(`[Screenshot] Navigating to: ${url}`);
        await page.goto(url, {
            timeout: TIMEOUT_MS,
            waitUntil: "networkidle",
        });

        // Wait for JS rendering
        await page.waitForTimeout(3000);

        // Scroll to trigger lazy-loaded content
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight / 3);
        });
        await page.waitForTimeout(1000);

        // Scroll back to top for screenshot
        await page.evaluate(() => {
            window.scrollTo(0, 0);
        });
        await page.waitForTimeout(500);

        // Get page title
        const title = await page.title();

        // Capture full page screenshot (PNG for quality)
        const screenshot = await page.screenshot({
            type: "png",
            fullPage: true,
        });

        await page.close();
        page = null;

        console.log(`[Screenshot] Captured ${screenshot.length} bytes`);

        return {
            success: true,
            screenshot,
            url,
            title,
            timestamp: new Date().toISOString(),
        };
    } catch (error: unknown) {
        if (page) {
            await page.close().catch(() => { });
        }

        if (error instanceof Error) {
            if (error.message.includes("Timeout")) {
                return {
                    success: false,
                    error: "Page load timed out",
                    code: "TIMEOUT",
                };
            }
            if (error.message.includes("403") || error.message.includes("blocked")) {
                return {
                    success: false,
                    error: "Page blocked our request",
                    code: "BLOCKED",
                };
            }
            return {
                success: false,
                error: error.message,
                code: "UNKNOWN",
            };
        }

        return {
            success: false,
            error: "Unknown error",
            code: "UNKNOWN",
        };
    }
}

/**
 * Cleanup browser instance
 */
export async function closeScreenshotBrowser(): Promise<void> {
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
    }
}
