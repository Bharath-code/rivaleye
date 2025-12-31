import { GoogleGenAI } from "@google/genai";

/**
 * AI Provider Module
 *
 * Unified interface for AI generation with fallback:
 * 1. Gemini 2.0 Flash (primary - free tier)
 * 2. OpenRouter (fallback - free models)
 */

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

export interface GenerateOptions {
    systemPrompt: string;
    userPrompt: string;
    maxTokens?: number;
    temperature?: number;
}

export interface GenerateResult {
    content: string;
    provider: "gemini" | "openrouter";
    model: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// GEMINI PROVIDER
// ══════════════════════════════════════════════════════════════════════════════

async function generateWithGemini(options: GenerateOptions): Promise<GenerateResult | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.log("[AI] Gemini API key not found, skipping...");
        return null;
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: `${options.systemPrompt}\n\n${options.userPrompt}` }
                    ]
                }
            ],
            config: {
                maxOutputTokens: options.maxTokens || 500,
                temperature: options.temperature || 0.3,
            }
        });

        const content = response.text || "";

        if (!content) {
            console.log("[AI] Gemini returned empty response");
            return null;
        }

        return {
            content,
            provider: "gemini",
            model: "gemini-2.0-flash",
        };
    } catch (error) {
        console.error("[AI] Gemini error:", error);
        return null;
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// OPENROUTER PROVIDER (Official SDK)
// ══════════════════════════════════════════════════════════════════════════════

import { OpenRouter } from "@openrouter/sdk";

const OPENROUTER_FREE_MODEL = "deepseek/deepseek-chat-v3-0324:free";

async function generateWithOpenRouter(options: GenerateOptions): Promise<GenerateResult | null> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.log("[AI] OpenRouter API key not found, skipping...");
        return null;
    }

    try {
        const openrouter = new OpenRouter({ apiKey });

        const result = openrouter.callModel({
            model: OPENROUTER_FREE_MODEL,
            instructions: options.systemPrompt,
            input: options.userPrompt,
        });

        const content = await result.getText();

        if (!content) {
            console.log("[AI] OpenRouter returned empty response");
            return null;
        }

        return {
            content,
            provider: "openrouter",
            model: OPENROUTER_FREE_MODEL,
        };
    } catch (error) {
        console.error("[AI] OpenRouter error:", error);
        return null;
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// UNIFIED GENERATE FUNCTION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Generate text using available AI providers (Gemini → OpenRouter fallback)
 */
export async function generateText(options: GenerateOptions): Promise<GenerateResult> {
    // Try Gemini first
    const geminiResult = await generateWithGemini(options);
    if (geminiResult) {
        console.log(`[AI] Generated with ${geminiResult.provider}/${geminiResult.model}`);
        return geminiResult;
    }

    // Fallback to OpenRouter
    const openRouterResult = await generateWithOpenRouter(options);
    if (openRouterResult) {
        console.log(`[AI] Generated with ${openRouterResult.provider}/${openRouterResult.model}`);
        return openRouterResult;
    }

    // All providers failed
    throw new Error("All AI providers failed. Check API keys.");
}

/**
 * Check if any AI provider is available
 */
export function isAIAvailable(): boolean {
    return !!(process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY);
}
