import { createHash } from "crypto";

/**
 * Text Normalization Module
 * 
 * Cleans web page content for consistent diff comparison.
 * Removes noise that doesn't affect meaning: dates, footers, whitespace, etc.
 */

// Common footer/boilerplate patterns to remove
const BOILERPLATE_PATTERNS = [
    /©\s*\d{4}/gi,                                    // Copyright years
    /all rights reserved/gi,
    /privacy policy/gi,
    /terms of service/gi,
    /terms and conditions/gi,
    /cookie policy/gi,
    /we use cookies/gi,
    /accept cookies/gi,
    /subscribe to our newsletter/gi,
    /sign up for updates/gi,
    /follow us on/gi,
    /connect with us/gi,
    /\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/g,               // Dates: MM/DD/YYYY
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2},?\s*\d{4}/gi, // Month DD, YYYY
    /\d+\s*(days?|hours?|minutes?)\s*ago/gi,          // Relative times
    /last updated/gi,
];

export function normalizeText(rawText: string): string {
    let text = rawText;

    // Convert to lowercase
    text = text.toLowerCase();

    // Remove boilerplate patterns
    for (const pattern of BOILERPLATE_PATTERNS) {
        text = text.replace(pattern, " ");
    }

    // Remove URLs
    text = text.replace(/https?:\/\/[^\s]+/g, " ");

    // Remove email addresses
    text = text.replace(/[\w.-]+@[\w.-]+\.\w+/g, " ");

    // Remove extra whitespace
    text = text.replace(/\s+/g, " ").trim();

    // Remove common punctuation noise while keeping meaningful punctuation
    text = text.replace(/[""'']/g, '"');      // Normalize quotes
    text = text.replace(/[—–]/g, "-");        // Normalize dashes

    return text;
}

export function hashText(text: string): string {
    return createHash("sha256")
        .update(text)
        .digest("hex");
}

export interface NormalizedSnapshot {
    normalizedText: string;
    hash: string;
}

export function createNormalizedSnapshot(rawText: string): NormalizedSnapshot {
    const normalizedText = normalizeText(rawText);
    const hash = hashText(normalizedText);

    return {
        normalizedText,
        hash,
    };
}
