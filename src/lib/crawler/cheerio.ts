import * as cheerio from "cheerio";
import type { CrawlResponse } from "@/lib/types";

/**
 * Cheerio Fetcher Module (Fallback #1)
 *
 * Lightweight HTTP fetch + HTML parsing.
 * No JavaScript execution — fast and free.
 */

const TIMEOUT_MS = 15000;

const USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Extract main content from HTML, converting to markdown-like text.
 */
function htmlToMarkdown($: cheerio.CheerioAPI): string {
    // Remove noise elements
    $("script, style, noscript, iframe, nav, footer, header, aside").remove();
    $("[class*='cookie'], [class*='banner'], [class*='popup'], [id*='cookie']").remove();

    const lines: string[] = [];

    // Process headings
    $("h1, h2, h3, h4, h5, h6").each((_, el) => {
        const level = parseInt(el.tagName[1]);
        const prefix = "#".repeat(level);
        const text = $(el).text().trim();
        if (text) lines.push(`${prefix} ${text}`);
    });

    // Process paragraphs and list items
    $("p, li").each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 20) lines.push(text);
    });

    // Process tables (important for pricing pages)
    $("table").each((_, table) => {
        $(table)
            .find("tr")
            .each((_, row) => {
                const cells: string[] = [];
                $(row)
                    .find("td, th")
                    .each((_, cell) => {
                        cells.push($(cell).text().trim());
                    });
                if (cells.length) lines.push(`| ${cells.join(" | ")} |`);
            });
    });

    return lines.join("\n\n");
}

export async function fetchPageCheerio(url: string): Promise<CrawlResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": USER_AGENT,
                Accept: "text/html,application/xhtml+xml",
                "Accept-Language": "en-US,en;q=0.9",
            },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            if (response.status === 403 || response.status === 429) {
                return {
                    success: false,
                    error: `Page blocked (${response.status})`,
                    code: "BLOCKED",
                };
            }
            return {
                success: false,
                error: `HTTP ${response.status}`,
                code: "API_ERROR",
            };
        }

        const html = await response.text();

        if (!html || html.length < 100) {
            return {
                success: false,
                error: "Empty response",
                code: "EMPTY",
            };
        }

        const $ = cheerio.load(html);
        const markdown = htmlToMarkdown($);

        if (markdown.length < 50) {
            return {
                success: false,
                error: "Could not extract meaningful content",
                code: "EMPTY",
            };
        }

        // Extract raw text
        const rawText = markdown
            .replace(/[#*_~`|]/g, "")
            .replace(/\n+/g, " ")
            .trim();

        return {
            success: true,
            markdown,
            rawText,
        };
    } catch (error: unknown) {
        clearTimeout(timeoutId);

        if (error instanceof Error) {
            if (error.name === "AbortError") {
                return {
                    success: false,
                    error: "Request timed out",
                    code: "TIMEOUT",
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
