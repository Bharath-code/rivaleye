import FirecrawlApp from "@mendable/firecrawl-js";
import type { CrawlResponse } from "@/lib/types";

/**
 * Firecrawl Fetcher Module
 * 
 * Fetches a URL via Firecrawl API and returns markdown + raw text.
 * Handles all error cases gracefully without throwing.
 */

const TIMEOUT_MS = 30000;

function getFirecrawlClient(): FirecrawlApp {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
        throw new Error("Missing FIRECRAWL_API_KEY environment variable");
    }
    return new FirecrawlApp({ apiKey });
}

export async function fetchPage(url: string): Promise<CrawlResponse> {
    try {
        const client = getFirecrawlClient();

        // Timeout wrapper
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT_MS);
        });

        const scrapePromise = client.scrape(url, {
            formats: ["markdown"],
            onlyMainContent: true,
        });

        // New SDK returns Document directly (not wrapped in { success, data })
        const result = await Promise.race([scrapePromise, timeoutPromise]);

        // Check for valid response
        if (!result) {
            return {
                success: false,
                error: "Firecrawl returned empty response",
                code: "API_ERROR",
            };
        }

        const markdown = result.markdown || "";

        // Check for empty content
        if (!markdown || markdown.trim().length < 50) {
            return {
                success: false,
                error: "Page returned empty or minimal content",
                code: "EMPTY",
            };
        }

        // Extract raw text by stripping markdown formatting
        const rawText = markdown
            .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Links
            .replace(/[*_~`#]/g, "") // Formatting
            .replace(/\n+/g, " ") // Newlines
            .trim();

        return {
            success: true,
            markdown,
            rawText,
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";

        if (message === "TIMEOUT") {
            return {
                success: false,
                error: "Request timed out after 30 seconds",
                code: "TIMEOUT",
            };
        }

        // Check for common block indicators
        if (message.includes("403") || message.includes("blocked")) {
            return {
                success: false,
                error: "Page blocked our request (likely bot protection)",
                code: "BLOCKED",
            };
        }

        return {
            success: false,
            error: message,
            code: "UNKNOWN",
        };
    }
}

/**
 * Retry wrapper for fetchPage
 * Attempts up to maxRetries before giving up
 */
export async function fetchPageWithRetry(
    url: string,
    maxRetries = 2
): Promise<CrawlResponse> {
    let lastResult: CrawlResponse | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const result = await fetchPage(url);

        if (result.success) {
            return result;
        }

        lastResult = result;

        // Don't retry if blocked or empty — those won't change
        if (result.code === "BLOCKED" || result.code === "EMPTY") {
            break;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries - 1) {
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
    }

    return lastResult || {
        success: false,
        error: "All retry attempts failed",
        code: "UNKNOWN",
    };
}
