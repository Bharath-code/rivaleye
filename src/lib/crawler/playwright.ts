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
            "[aria-hidden='true']",
            ".sr-only",
            ".visually-hidden",
        ];

        removeSelectors.forEach((sel) => {
            document.querySelectorAll(sel).forEach((el) => el.remove());
        });

        const lines: string[] = [];
        const seen = new Set<string>();

        // Detect ASCII art patterns
        const isAsciiArt = (text: string): boolean => {
            // ASCII art typically has:
            // 1. High ratio of special characters
            // 2. Patterns of repeated symbols
            // 3. Very few actual words

            const specialChars = text.match(/[':;\-_=+^".,|]/g) || [];
            const letters = text.match(/[a-zA-Z]/g) || [];

            // If special chars outnumber letters significantly, it's likely ASCII art
            if (specialChars.length > letters.length * 2 && text.length > 50) {
                return true;
            }

            // Check for repeated patterns like .''' or ---
            if (/(.)\1{4,}/.test(text)) {
                return true;
            }

            // Check for dot/dash heavy content
            const dotDashRatio = (text.match(/[.'\-_:=+]/g) || []).length / text.length;
            if (dotDashRatio > 0.5 && text.length > 30) {
                return true;
            }

            return false;
        };

        const addLine = (text: string, prefix = "") => {
            const clean = text.trim().replace(/\s+/g, " ");

            // Skip if too short, already seen, or ASCII art
            if (!clean || clean.length < 10 || seen.has(clean) || isAsciiArt(clean)) {
                return;
            }

            seen.add(clean);
            lines.push(prefix ? `${prefix} ${clean}` : clean);
        };

        // Process headings
        document.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((el) => {
            const level = parseInt(el.tagName[1]);
            const prefix = "#".repeat(level);
            const text = el.textContent || "";
            addLine(text, prefix);
        });

        // Process pricing cards (common patterns for SaaS pricing)
        const pricingSelectors = [
            "[class*='price']",
            "[class*='plan']",
            "[class*='tier']",
            "[class*='pricing']",
            "[class*='card']",
            "[data-plan]",
            "[data-price]",
        ];

        pricingSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach((el) => {
                const text = el.textContent || "";
                // Only add if it looks like pricing content
                if (/\$[\d,]+|\d+\s*\/\s*mo|free|credits|month|year/i.test(text)) {
                    addLine(text);
                }
            });
        });

        // Process paragraphs and list items
        document.querySelectorAll("p, li").forEach((el) => {
            const text = el.textContent || "";
            if (text.length > 20) addLine(text);
        });

        // Process tables
        document.querySelectorAll("table").forEach((table) => {
            table.querySelectorAll("tr").forEach((row) => {
                const cells: string[] = [];
                row.querySelectorAll("td, th").forEach((cell) => {
                    const text = cell.textContent?.trim();
                    if (text) cells.push(text);
                });
                if (cells.length) addLine(`| ${cells.join(" | ")} |`);
            });
        });

        // Fallback: Get ALL visible text if we didn't capture much
        if (lines.length < 10) {
            const main = document.querySelector("main") || document.body;
            const walker = document.createTreeWalker(
                main,
                NodeFilter.SHOW_TEXT,
                null
            );

            let node;
            while ((node = walker.nextNode())) {
                const text = node.textContent || "";
                if (text.trim().length > 15) {
                    addLine(text);
                }
            }
        }

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

        // Navigate with timeout and wait for network to settle
        await page.goto(url, {
            timeout: TIMEOUT_MS,
            waitUntil: "networkidle",
        });

        // Wait for JS content to render
        await page.waitForTimeout(3000);

        // Scroll to trigger lazy-loaded pricing content
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight / 2);
        });
        await page.waitForTimeout(1500);

        // Try to find and click monthly/yearly toggle if present
        const toggleSelectors = [
            "[class*='toggle']",
            "[class*='switch']",
            "button:has-text('Monthly')",
            "button:has-text('Yearly')",
        ];
        for (const sel of toggleSelectors) {
            try {
                const toggle = page.locator(sel).first();
                if (await toggle.isVisible({ timeout: 500 })) {
                    await toggle.click();
                    await page.waitForTimeout(500);
                    break;
                }
            } catch {
                // Not found, continue
            }
        }

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
