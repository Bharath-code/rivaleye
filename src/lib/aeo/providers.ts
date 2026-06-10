/**
 * AEO (Answer Engine Optimization) Provider Abstraction
 *
 * Unified interface for querying 5 different LLM-powered "answer engines":
 *  - ChatGPT (OpenAI)
 *  - Perplexity (their own API; great for citation tracking)
 *  - Claude (Anthropic)
 *  - Gemini (Google)
 *  - Google AI Overviews (via Google's Search Generative Experience)
 *
 * Each provider returns:
 *  - response_text: the raw answer (truncated to 2KB for storage)
 *  - citations: array of URLs the model referenced
 *
 * Why this abstraction:
 *  - We can swap providers without changing the parser
 *  - We can A/B test different models for cost vs quality
 *  - We can add new answer engines (Bing Chat, Mistral, etc.) without redesign
 *
 * Cost (per query, 2026 pricing):
 *  - ChatGPT 4o-mini:    $0.00015
 *  - Perplexity Sonar:    $0.001
 *  - Claude Haiku 3.5:    $0.00025
 *  - Gemini 2.0 Flash:   $0.00002
 *  - Google AI Overviews: $0 (free via SerpAPI scraping, but rate-limited)
 *
 * Strategy: We use the cheapest model per provider by default.
 * Users can upgrade to "Pro scan" later that uses GPT-4o + Sonnet for higher quality.
 */

export type ModelName =
    | "chatgpt"
    | "perplexity"
    | "claude"
    | "gemini"
    | "google_ai";

export interface AEOQuery {
    prompt: string;
    /** Optional: the competitor we're checking mentions for (used for self-references) */
    competitorName: string;
    /** Optional: industry context (e.g. "CRM software") */
    industry?: string;
}

export interface AEOResponse {
    model: ModelName;
    response_text: string;
    citations: string[];
    /** Cost in USD for this single query */
    cost_usd: number;
    /** Latency in ms */
    latency_ms: number;
}

export interface AEOProvider {
    name: ModelName;
    query(q: AEOQuery): Promise<AEOResponse>;
}

// ══════════════════════════════════════════════════════════════════════════════
// OpenAI (ChatGPT)
// ══════════════════════════════════════════════════════════════════════════════

class OpenAIProvider implements AEOProvider {
    name = "chatgpt" as const;

    async query(q: AEOQuery): Promise<AEOResponse> {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return this.empty("OPENAI_API_KEY not configured");
        }

        const start = Date.now();
        try {
            const res = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "system",
                            content:
                                "You are a helpful assistant. When recommending tools or services, cite the specific URLs where you learned about them. Be concrete and list multiple options when relevant.",
                        },
                        { role: "user", content: q.prompt },
                    ],
                    max_tokens: 500,
                    temperature: 0.3,
                }),
            });

            if (!res.ok) {
                const text = await res.text();
                return this.empty(`OpenAI API error: ${res.status} ${text.slice(0, 100)}`);
            }

            const data = await res.json();
            const responseText = data.choices?.[0]?.message?.content || "";
            const latency = Date.now() - start;

            return {
                model: "chatgpt",
                response_text: responseText.slice(0, 2048),
                citations: extractUrlsFromText(responseText),
                cost_usd: 0.00015,
                latency_ms: latency,
            };
        } catch (err) {
            return this.empty(`OpenAI request failed: ${(err as Error).message}`);
        }
    }

    private empty(reason: string): AEOResponse {
        return {
            model: "chatgpt",
            response_text: "",
            citations: [],
            cost_usd: 0,
            latency_ms: 0,
        };
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// Perplexity
// ══════════════════════════════════════════════════════════════════════════════

class PerplexityProvider implements AEOProvider {
    name = "perplexity" as const;

    async query(q: AEOQuery): Promise<AEOResponse> {
        const apiKey = process.env.PERPLEXITY_API_KEY;
        if (!apiKey) {
            return this.empty("PERPLEXITY_API_KEY not configured");
        }

        const start = Date.now();
        try {
            const res = await fetch("https://api.perplexity.ai/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: "sonar",
                    messages: [
                        {
                            role: "system",
                            content:
                                "Be precise and cite sources. When listing tools or services, include their official URLs.",
                        },
                        { role: "user", content: q.prompt },
                    ],
                    max_tokens: 500,
                    temperature: 0.2,
                }),
            });

            if (!res.ok) {
                const text = await res.text();
                return this.empty(`Perplexity API error: ${res.status} ${text.slice(0, 100)}`);
            }

            const data = await res.json();
            const responseText = data.choices?.[0]?.message?.content || "";
            const latency = Date.now() - start;

            // Perplexity returns citations in a separate field
            const citations: string[] = (data.citations || []).filter(
                (u: unknown): u is string => typeof u === "string"
            );
            // Also extract any URLs from the prose
            citations.push(...extractUrlsFromText(responseText));

            return {
                model: "perplexity",
                response_text: responseText.slice(0, 2048),
                citations: [...new Set(citations)].slice(0, 20),
                cost_usd: 0.001,
                latency_ms: latency,
            };
        } catch (err) {
            return this.empty(`Perplexity request failed: ${(err as Error).message}`);
        }
    }

    private empty(reason: string): AEOResponse {
        return {
            model: "perplexity",
            response_text: "",
            citations: [],
            cost_usd: 0,
            latency_ms: 0,
        };
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// Anthropic (Claude)
// ══════════════════════════════════════════════════════════════════════════════

class AnthropicProvider implements AEOProvider {
    name = "claude" as const;

    async query(q: AEOQuery): Promise<AEOResponse> {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            return this.empty("ANTHROPIC_API_KEY not configured");
        }

        const start = Date.now();
        try {
            const res = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                    "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify({
                    model: "claude-3-5-haiku-20241022",
                    max_tokens: 500,
                    system:
                        "You are a helpful assistant that recommends tools and services. When you mention a specific product, mention its official URL.",
                    messages: [{ role: "user", content: q.prompt }],
                }),
            });

            if (!res.ok) {
                const text = await res.text();
                return this.empty(`Anthropic API error: ${res.status} ${text.slice(0, 100)}`);
            }

            const data = await res.json();
            const responseText =
                data.content?.[0]?.type === "text" ? data.content[0].text : "";
            const latency = Date.now() - start;

            return {
                model: "claude",
                response_text: responseText.slice(0, 2048),
                citations: extractUrlsFromText(responseText),
                cost_usd: 0.00025,
                latency_ms: latency,
            };
        } catch (err) {
            return this.empty(`Anthropic request failed: ${(err as Error).message}`);
        }
    }

    private empty(reason: string): AEOResponse {
        return {
            model: "claude",
            response_text: "",
            citations: [],
            cost_usd: 0,
            latency_ms: 0,
        };
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// Google Gemini
// ══════════════════════════════════════════════════════════════════════════════

class GeminiProvider implements AEOProvider {
    name = "gemini" as const;

    async query(q: AEOQuery): Promise<AEOResponse> {
        const apiKey =
            process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return this.empty("GEMINI_API_KEY not configured");
        }

        const start = Date.now();
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: `${q.prompt}\n\nWhen you mention specific products, include their official URLs in your response.`,
                                },
                            ],
                        },
                    ],
                    generationConfig: {
                        maxOutputTokens: 500,
                        temperature: 0.3,
                    },
                }),
            });

            if (!res.ok) {
                const text = await res.text();
                return this.empty(`Gemini API error: ${res.status} ${text.slice(0, 100)}`);
            }

            const data = await res.json();
            const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const latency = Date.now() - start;

            return {
                model: "gemini",
                response_text: responseText.slice(0, 2048),
                citations: extractUrlsFromText(responseText),
                cost_usd: 0.00002,
                latency_ms: latency,
            };
        } catch (err) {
            return this.empty(`Gemini request failed: ${(err as Error).message}`);
        }
    }

    private empty(reason: string): AEOResponse {
        return {
            model: "gemini",
            response_text: "",
            citations: [],
            cost_usd: 0,
            latency_ms: 0,
        };
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// Google AI Overviews (via SerpAPI or DataForSEO)
// Uses Google's SGE scraping since there's no first-party API.
// ══════════════════════════════════════════════════════════════════════════════

class GoogleAIOverviewsProvider implements AEOProvider {
    name = "google_ai" as const;

    async query(q: AEOQuery): Promise<AEOResponse> {
        const apiKey = process.env.SERP_API_KEY;
        if (!apiKey) {
            return this.empty("SERP_API_KEY not configured");
        }

        const start = Date.now();
        try {
            // SerpAPI: request Google search with AI Overview included
            const params = new URLSearchParams({
                api_key: apiKey,
                q: q.prompt,
                engine: "google",
                num: "10",
            });
            const res = await fetch(
                `https://serpapi.com/search.json?${params.toString()}`
            );

            if (!res.ok) {
                const text = await res.text();
                return this.empty(`SerpAPI error: ${res.status} ${text.slice(0, 100)}`);
            }

            const data = await res.json();
            const latency = Date.now() - start;

            // Extract AI Overview if present (SerpAPI returns it as `ai_overview`)
            const aiOverview = data.ai_overview;
            if (!aiOverview) {
                return {
                    model: "google_ai",
                    response_text: "",
                    citations: [],
                    cost_usd: 0.01, // SerpAPI is more expensive
                    latency_ms: latency,
                };
            }

            // The AI Overview is a structured object; flatten to text
            const responseText = flattenAIOverview(aiOverview);
            const citations = extractUrlsFromText(responseText);

            return {
                model: "google_ai",
                response_text: responseText.slice(0, 2048),
                citations: citations.slice(0, 20),
                cost_usd: 0.01,
                latency_ms: latency,
            };
        } catch (err) {
            return this.empty(`Google AI Overviews failed: ${(err as Error).message}`);
        }
    }

    private empty(reason: string): AEOResponse {
        return {
            model: "google_ai",
            response_text: "",
            citations: [],
            cost_usd: 0,
            latency_ms: 0,
        };
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════════

const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/g;

function extractUrlsFromText(text: string): string[] {
    if (!text) return [];
    const matches = text.match(URL_REGEX) || [];
    return [...new Set(matches)].slice(0, 20);
}

/**
 * Flatten SerpAPI's ai_overview structure (which is a nested object) to text.
 * The structure varies, so we walk it defensively.
 */
function flattenAIOverview(overview: unknown): string {
    if (typeof overview === "string") return overview;
    if (Array.isArray(overview)) {
        return overview.map(flattenAIOverview).join("\n");
    }
    if (overview && typeof overview === "object") {
        const obj = overview as Record<string, unknown>;
        // Common SerpAPI fields
        if (typeof obj.text === "string") return obj.text;
        if (typeof obj.snippet === "string") return obj.snippet;
        if (Array.isArray(obj.text_blocks)) {
            return obj.text_blocks
                .map((b: unknown) =>
                    b && typeof b === "object" && "text" in b
                        ? (b as { text: string }).text
                        : ""
                )
                .join("\n");
        }
        // Generic recursion
        return Object.values(obj).map(flattenAIOverview).join("\n");
    }
    return "";
}

// ══════════════════════════════════════════════════════════════════════════════
// Registry
// ══════════════════════════════════════════════════════════════════════════════

const PROVIDERS: Record<ModelName, AEOProvider> = {
    chatgpt: new OpenAIProvider(),
    perplexity: new PerplexityProvider(),
    claude: new AnthropicProvider(),
    gemini: new GeminiProvider(),
    google_ai: new GoogleAIOverviewsProvider(),
};

export function getProvider(model: ModelName): AEOProvider {
    return PROVIDERS[model];
}

export function getAllProviders(): AEOProvider[] {
    return Object.values(PROVIDERS);
}

/**
 * Query a single model. Returns null on any error (treat as "no data" for the scan).
 */
export async function queryModel(
    model: ModelName,
    q: AEOQuery
): Promise<AEOResponse | null> {
    try {
        const provider = getProvider(model);
        const result = await provider.query(q);
        // If the response is empty (no API key, etc.), treat as null
        if (!result.response_text) return null;
        return result;
    } catch {
        return null;
    }
}
