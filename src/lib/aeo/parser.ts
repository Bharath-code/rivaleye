/**
 * AEO Mention Parser
 *
 * Given an LLM response and a brand name, determine:
 *  1. Is the brand mentioned?
 *  2. At what position? (1 = first mention)
 *  3. What citations are present?
 *
 * The hard problem: brand names are ambiguous. "Stripe" is unique.
 * "Linear" is also a math concept. "Notion" is also a philosophy term.
 *
 * Strategy: combine 3 signals to make a robust decision:
 *  1. Exact case-insensitive match
 *  2. Match with surrounding context (e.g. "linear.app", "Linear is a tool")
 *  3. URL match (if the LLM cited the competitor's URL, that's a strong mention signal)
 *
 * Position is computed as: the order in which the brand appears in the response,
 * counting only "first mention per sentence" (to avoid one paragraph repeating the
 * brand inflating the position count).
 */

export interface MentionCheck {
    mentioned: boolean;
    position: number | null;
    /** The sentence where the brand was first mentioned */
    excerpt: string | null;
}

/**
 * Normalize a brand name for matching:
 *  - Lowercase
 *  - Strip common suffixes like "Inc", "LLC", "Corp"
 *  - Strip "the" prefix
 */
function normalize(name: string): string {
    return name
        .toLowerCase()
        .replace(/\b(inc|llc|ltd|corp|co|company|gmbh|sas)\b\.?$/i, "")
        .replace(/^the\s+/i, "")
        .trim();
}

/**
 * Build a set of search patterns for the brand.
 * Returns multiple variants: full name, slug, etc.
 */
function buildSearchPatterns(brand: string, url?: string): string[] {
    const patterns: string[] = [];
    const normalized = normalize(brand);
    patterns.push(normalized);

    // Slug: extract from URL
    if (url) {
        try {
            const u = new URL(url);
            const host = u.hostname.replace(/^www\./, "").toLowerCase();
            // e.g. "linear.app" → "linear-app"
            patterns.push(host.replace(/\./g, "-"));
            // e.g. "linear.app" → "linear"
            const baseDomain = host.split(".")[0];
            if (baseDomain && baseDomain.length >= 3) {
                patterns.push(baseDomain);
            }
        } catch {
            // ignore invalid URL
        }
    }

    // First word if multi-word (e.g. "Sales Force" → "Sales")
    const firstWord = normalized.split(/\s+/)[0];
    if (firstWord && firstWord.length >= 4) {
        patterns.push(firstWord);
    }

    return [...new Set(patterns)].filter((p) => p.length >= 3);
}

/**
 * Find the first mention position and excerpt.
 * Position = 1-based index of the sentence (paragraph) where the brand
 * first appears. Sentences are split by `.`, `!`, `?`, or newlines.
 */
function findFirstMention(
    text: string,
    patterns: string[]
): { position: number; excerpt: string } | null {
    if (!text || patterns.length === 0) return null;

    // Split into sentences (rough but works for LLM responses)
    const sentences = text
        .split(/(?<=[.!?\n])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i].toLowerCase();
        for (const pattern of patterns) {
            // Use word boundaries to avoid matching "lin" inside "linear-algebra"
            const regex = new RegExp(
                `\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
                "i"
            );
            if (regex.test(sentence)) {
                return {
                    position: i + 1,
                    excerpt: sentences[i].slice(0, 300),
                };
            }
        }
    }

    return null;
}

/**
 * Check if the brand is mentioned, and if so, where.
 */
export function detectMention(
    text: string,
    brand: string,
    brandUrl?: string
): MentionCheck {
    const patterns = buildSearchPatterns(brand, brandUrl);
    const result = findFirstMention(text, patterns);

    if (!result) {
        return { mentioned: false, position: null, excerpt: null };
    }

    return {
        mentioned: true,
        position: result.position,
        excerpt: result.excerpt,
    };
}

/**
 * Check if a citation URL matches the brand (strong mention signal).
 * Returns the matching URL or null.
 */
export function findBrandCitation(
    citations: string[],
    brand: string,
    brandUrl?: string
): string | null {
    if (!brandUrl) return null;
    try {
        const u = new URL(brandUrl);
        const host = u.hostname.replace(/^www\./, "").toLowerCase();
        return citations.find((c) => {
            try {
                const cu = new URL(c);
                return cu.hostname.replace(/^www\./, "").toLowerCase() === host;
            } catch {
                return false;
            }
        }) || null;
    } catch {
        return null;
    }
}

/**
 * Combined check: brand is "mentioned" if either:
 *  1. The text contains the brand name
 *  2. The citations include the brand's URL
 *
 * This dual-signal approach catches the case where the LLM cites a brand
 * without using its name in the prose (e.g. "see [1]" with [1] being
 * the brand's website).
 */
export function isBrandMentioned(
    text: string,
    citations: string[],
    brand: string,
    brandUrl?: string
): MentionCheck {
    // 1. Check for textual mention
    const textMention = detectMention(text, brand, brandUrl);
    if (textMention.mentioned) {
        return textMention;
    }

    // 2. Check for URL citation
    const citation = findBrandCitation(citations, brand, brandUrl);
    if (citation) {
        return {
            mentioned: true,
            position: null, // Citation but no prose mention
            excerpt: `Cited as ${citation}`,
        };
    }

    return { mentioned: false, position: null, excerpt: null };
}
