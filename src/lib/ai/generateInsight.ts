import OpenAI from "openai";
import type { AIInsight, DiffResult, MeaningfulnessResult } from "@/lib/types";

/**
 * AI Insight Generator
 * 
 * Uses OpenAI to generate business-relevant insights from detected changes.
 * Constrained prompt to prevent hallucination and over-claiming.
 */

function getOpenAIClient(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error("Missing OPENAI_API_KEY environment variable");
    }
    return new OpenAI({ apiKey });
}

const SYSTEM_PROMPT = `You are a competitive intelligence analyst for SaaS companies. Your job is to interpret changes detected on competitor websites and provide actionable insights.

RULES (CRITICAL - DO NOT VIOLATE):
1. NEVER invent facts. Only describe what you can observe from the changes.
2. Use probabilistic language: "may indicate", "could suggest", "possibly signals"
3. Separate OBSERVATIONS (facts from the diff) from INTERPRETATIONS (what it might mean)
4. If the change is ambiguous, say so. Better to under-claim than over-claim.
5. Keep responses concise and actionable.
6. Format your response EXACTLY as specified.

RESPONSE FORMAT:
WHAT CHANGED: [Factual description of the change, 1-2 sentences]

WHY THIS MAY MATTER: [Business interpretation, what this could signal about their strategy, 2-3 sentences]

WHAT TO CONSIDER: [1-2 concrete actions the user might consider, phrased as suggestions not commands]`;

const NO_SIGNAL_RESPONSE: AIInsight = {
    whatChanged: "Minor content updates detected.",
    whyItMatters: "No meaningful competitive signal detected. The changes appear to be routine updates (grammar, formatting, or housekeeping).",
    whatToDo: "No action needed at this time.",
    confidence: "low",
};

export async function generateInsight(
    diff: DiffResult,
    meaningfulness: MeaningfulnessResult,
    competitorName: string
): Promise<AIInsight> {
    // If not meaningful, return canned response
    if (!meaningfulness.isMeaningful) {
        return NO_SIGNAL_RESPONSE;
    }

    try {
        const client = getOpenAIClient();

        // Build the user prompt with the diff context
        const changesDescription = diff.changedBlocks
            .slice(0, 5) // Limit to 5 blocks to control token usage
            .map((block, i) => {
                if (block.oldText && block.newText) {
                    return `Change ${i + 1}:\n  Before: "${block.oldText}"\n  After: "${block.newText}"`;
                } else if (block.newText) {
                    return `Addition ${i + 1}: "${block.newText}"`;
                } else {
                    return `Removal ${i + 1}: "${block.oldText}"`;
                }
            })
            .join("\n\n");

        const userPrompt = `Competitor: ${competitorName}
Signal Type: ${meaningfulness.signalType || "general"}
Detection Reason: ${meaningfulness.reason}

DETECTED CHANGES:
${changesDescription}

Analyze these changes and provide your insight following the exact format specified.`;

        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userPrompt },
            ],
            temperature: 0.3, // Low temperature for consistent, factual outputs
            max_tokens: 500,
        });

        const content = response.choices[0]?.message?.content || "";

        // Parse the response
        const insight = parseInsightResponse(content, meaningfulness);

        return insight;
    } catch (error) {
        console.error("Error generating AI insight:", error);

        // Fallback to a basic insight based on the detection
        return {
            whatChanged: meaningfulness.reason,
            whyItMatters: `A ${meaningfulness.signalType || "notable"} change was detected. Review the details to understand the competitive implications.`,
            whatToDo: "Review the change details and assess if this affects your positioning or pricing strategy.",
            confidence: "low",
        };
    }
}

function parseInsightResponse(
    content: string,
    meaningfulness: MeaningfulnessResult
): AIInsight {
    // Extract sections using regex ([\s\S] for cross-line matching without /s flag)
    const whatChangedMatch = content.match(/WHAT CHANGED:\s*([\s\S]+?)(?=WHY THIS MAY MATTER:|$)/);
    const whyMattersMatch = content.match(/WHY THIS MAY MATTER:\s*([\s\S]+?)(?=WHAT TO CONSIDER:|$)/);
    const whatToDoMatch = content.match(/WHAT TO CONSIDER:\s*([\s\S]+?)$/);

    const whatChanged = whatChangedMatch?.[1]?.trim() || meaningfulness.reason;
    const whyItMatters = whyMattersMatch?.[1]?.trim() || "This change may indicate a shift in their competitive strategy.";
    const whatToDo = whatToDoMatch?.[1]?.trim() || "Consider reviewing how this might affect your positioning.";

    // Determine confidence based on signal type
    let confidence: "high" | "medium" | "low" = "medium";
    if (meaningfulness.signalType === "pricing") {
        confidence = "high";
    } else if (meaningfulness.signalType === "positioning") {
        confidence = "low";
    }

    return {
        whatChanged,
        whyItMatters,
        whatToDo,
        confidence,
    };
}
