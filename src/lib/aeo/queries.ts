/**
 * AEO Query Generator
 *
 * Given a competitor (name, URL, industry), generate the high-intent
 * queries a real user would type into ChatGPT/Perplexity/Claude.
 *
 * Strategy: 5-10 queries that span 3 user intents:
 *   1. Discovery: "best [industry] tools"
 *   2. Comparison: "[competitor] vs [competitor]"
 *   3. Alternative-seeking: "alternatives to [competitor]"
 *   4. Specific use case: "best [industry] for [persona]"
 *   5. Pricing: "is [competitor] worth it"
 *
 * The queries are stored on the competitor row (competitors.aeo_queries)
 * so users can edit them. This generator is the default; users override
 * per their positioning strategy.
 *
 * Note: We use a third-party URL → company-name parser as fallback.
 * In production, you'd want to use Clearbit / Apollo for this.
 */

export interface CompetitorInput {
    name: string;
    url: string;
    industry?: string;
}

export interface QueryTemplate {
    template: (c: CompetitorInput) => string;
    category: "discovery" | "comparison" | "alternative" | "use_case" | "pricing";
}

/**
 * Built-in query templates. These are the "default" set every
 * competitor gets scanned against.
 */
const DEFAULT_TEMPLATES: QueryTemplate[] = [
    // Discovery
    {
        category: "discovery",
        template: (c) => `What are the best ${c.industry ?? "tools"} like ${c.name}?`,
    },
    {
        category: "discovery",
        template: (c) => `Top ${c.industry ?? "software"} companies in 2026`,
    },

    // Comparison
    {
        category: "comparison",
        template: (c) => `${c.name} vs the top alternatives — which is better?`,
    },
    {
        category: "comparison",
        template: (c) => `Compare ${c.name} to its main competitors`,
    },

    // Alternative-seeking (highest commercial intent)
    {
        category: "alternative",
        template: (c) => `Best alternatives to ${c.name}`,
    },
    {
        category: "alternative",
        template: (c) => `Tools similar to ${c.name} but cheaper`,
    },
    {
        category: "alternative",
        template: (c) => `${c.name} competitors and how they compare`,
    },

    // Use case
    {
        category: "use_case",
        template: (c) => `What ${c.industry ?? "tools"} should a small startup use in 2026?`,
    },

    // Pricing
    {
        category: "pricing",
        template: (c) => `Is ${c.name} worth the price? Honest review`,
    },
];

/**
 * Generate the default query set for a competitor.
 * Returns 5-10 queries (deduplicated, length-filtered).
 */
export function generateDefaultQueries(c: CompetitorInput): string[] {
    const queries = DEFAULT_TEMPLATES.map((t) => t.template(c));
    // Dedupe and filter for quality
    return [...new Set(queries)]
        .filter((q) => q.length > 10 && q.length < 200)
        .slice(0, 10);
}

/**
 * Curate a smaller, focused query set (5 queries) for budget-conscious users.
 * Skips the lowest-intent categories.
 */
export function generateLiteQueries(c: CompetitorInput): string[] {
    const lite: QueryTemplate[] = [
        DEFAULT_TEMPLATES.find((t) => t.category === "alternative")!,
        DEFAULT_TEMPLATES.find((t) => t.category === "comparison")!,
        DEFAULT_TEMPLATES.find((t) => t.category === "discovery")!,
    ];
    return lite.map((t) => t.template(c));
}
