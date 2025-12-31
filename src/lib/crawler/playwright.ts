import { chromium, type Browser, type Page } from "playwright";
import type { CrawlResponse } from "@/lib/types";

/**
 * Playwright Fetcher Module (Fallback #2)
 *
 * Full headless browser for JS-rendered pages.
 * Slower but handles dynamic content.
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

function extractContent(page: Page): Promise<{ markdown: string; rawText: string }> {
    return page.evaluate(() => {
        // Remove noise elements
        const removeSelectors = [
            "script",
            "style",
            "noscript",
            "iframe",
            "nav",
            "footer",
            "header",
            "aside",
            "[class*='cookie']",
            "[class*='banner']",
            "[class*='popup']",
            "[id*='cookie']",
        ];

        removeSelectors.forEach((sel) => {
            document.querySelectorAll(sel).forEach((el) => el.remove());
        });

        const lines: string[] = [];

        // Process headings
        document.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((el) => {
            const level = parseInt(el.tagName[1]);
            const prefix = "#".repeat(level);
            const text = el.textContent?.trim();
            if (text) lines.push(`${prefix} ${text}`);
        });

        // Process paragraphs and list items
        document.querySelectorAll("p, li").forEach((el) => {
            const text = el.textContent?.trim();
            if (text && text.length > 20) lines.push(text);
        });

        // Process tables
        document.querySelectorAll("table").forEach((table) => {
            table.querySelectorAll("tr").forEach((row) => {
                const cells: string[] = [];
                row.querySelectorAll("td, th").forEach((cell) => {
                    const text = cell.textContent?.trim();
                    if (text) cells.push(text);
                });
                if (cells.length) lines.push(`| ${cells.join(" | ")} |`);
            });
        });

        const markdown = lines.join("\n\n");
        const rawText = markdown
            .replace(/[#*_~`|]/g, "")
            .replace(/\n+/g, " ")
            .trim();

        return { markdown, rawText };
    });
}

export async function fetchPagePlaywright(url: string): Promise<CrawlResponse> {
    let page: Page | null = null;

    try {
        const browser = await getBrowser();
        page = await browser.newPage();

        // Set realistic viewport and user agent
        await page.setViewportSize({ width: 1280, height: 800 });

        // Navigate with timeout
        await page.goto(url, {
            timeout: TIMEOUT_MS,
            waitUntil: "domcontentloaded",
        });

        // Wait for content to stabilize
        await page.waitForTimeout(2000);

        const { markdown, rawText } = await extractContent(page);

        await page.close();
        page = null;

        if (markdown.length < 50) {
            return {
                success: false,
                error: "Could not extract meaningful content",
                code: "EMPTY",
            };
        }

        return {
            success: true,
            markdown,
            rawText,
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
 * Cleanup browser instance (call on shutdown)
 */
export async function closeBrowser(): Promise<void> {
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
    }
}
