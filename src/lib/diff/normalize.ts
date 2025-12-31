import { createHash } from "crypto";

/**
 * Text Normalization Module
 *
 * Cleans web page content for consistent diff comparison.
 * Removes noise that doesn't affect meaning: dates, footers, whitespace, etc.
 */

// Maximum characters to keep (limits token usage)
const MAX_CONTENT_LENGTH = 4000;

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
    // Footer patterns
    /backed by.*?combinator/gi,
    /soc\s*(2|ii)/gi,
    /aicpa/gi,
    // Remove Twitter/social testimonial metadata
    /@\w+\s*"/g,                                       // @username"
    /\!\[.*?\]\(https?:\/\/[^\)]+\)/g,                 // ![image](url)
    /\[.*?\]\(https?:\/\/x\.com[^\)]+\)/g,            // Twitter links
    /\[.*?\]\(https?:\/\/twitter\.com[^\)]+\)/g,      // Twitter links alt
];

// Sections to truncate/remove (less valuable for diff detection)
const LOW_VALUE_SECTIONS = [
    /testimonials?[\s\S]*?(?=##|$)/gi,
    /faq[\s\S]*?(?=##|$)/gi,
    /footer[\s\S]*?(?=##|$)/gi,
    /people love[\s\S]*?(?=##|$)/gi,
];

export function normalizeText(rawText: string): string {
    let text = rawText;

    // Convert to lowercase
    text = text.toLowerCase();

    // Remove low-value sections first (before other processing)
    for (const pattern of LOW_VALUE_SECTIONS) {
        text = text.replace(pattern, " ");
    }

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

    // Truncate to max length (keep first N chars which are usually most important)
    if (text.length > MAX_CONTENT_LENGTH) {
        text = text.slice(0, MAX_CONTENT_LENGTH);
        // Try to end at a sentence boundary
        const lastSentence = text.lastIndexOf(". ");
        if (lastSentence > MAX_CONTENT_LENGTH * 0.8) {
            text = text.slice(0, lastSentence + 1);
        }
    }

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

