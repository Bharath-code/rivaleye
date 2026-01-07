import { GoogleGenAI } from "@google/genai";

/**
 * Vision Analyzer Module
 *
 * Uses Gemini vision to analyze competitor page screenshots
 * and extract comprehensive competitive intelligence.
 */

export interface PricingPlan {
    name: string;
    price: string;
    period: string;
    credits?: string;
    features: string[];
    highlight?: string;
}

export interface CompetitorAnalysis {
    // Company Info
    companyName: string;
    tagline?: string;

    // Pricing
    pricing: {
        plans: PricingPlan[];
        billingOptions?: string[];
        currency?: string;
        promotions?: string[];
    };

    // Product/Features
    features: {
        highlighted: string[];
        differentiators: string[];
    };

    // Positioning
    positioning: {
        targetAudience?: string;
        valueProposition?: string;
        socialProof?: string[];
    };

    // Key Insights
    insights: string[];

    // Technical Details
    integrations?: string[];
    security?: string[];

    // Summary
    summary: string;
}

export interface AnalysisResult {
    success: true;
    analysis: CompetitorAnalysis;
    rawAnalysis: string;
    model: string;
    timestamp: string;
    screenshotSize: number;
}

export interface AnalysisError {
    success: false;
    error: string;
}

export type VisionAnalysisResponse = AnalysisResult | AnalysisError;

const ANALYSIS_PROMPT = `You are a competitive intelligence analyst. Analyze this competitor webpage screenshot comprehensively.

Extract ALL relevant business intelligence:

## 1. COMPANY & BRAND
- Company name
- Tagline or slogan
- Brand positioning

## 2. PRICING & PLANS (if visible)
- All pricing tiers with names and prices
- What's included in each tier
- Billing options (monthly/yearly)
- Any promotions or discounts
- Free tier details

## 3. PRODUCT & FEATURES
- Key features highlighted
- What makes them different from competitors
- Use cases mentioned

## 4. TARGET AUDIENCE
- Who is this product for?
- Industry focus
- Company size targets

## 5. SOCIAL PROOF
- Customer logos
- Testimonials
- Trust badges (SOC2, etc.)
- "Backed by" mentions

## 6. TECHNICAL DETAILS
- Integrations mentioned
- Security certifications
- API/SDK mentions

## 7. KEY INSIGHTS
- What are 3-5 actionable insights a competitor should know?
- Any strategic signals (new launch, price change, market shift)?

Format your response as JSON:
{
  "companyName": "string",
  "tagline": "string or null",
  "pricing": {
    "plans": [{"name": "string", "price": "string", "period": "string", "credits": "string or null", "features": ["string"], "highlight": "string or null"}],
    "billingOptions": ["monthly", "yearly"],
    "currency": "USD",
    "promotions": ["string"]
  },
  "features": {
    "highlighted": ["feature1", "feature2"],
    "differentiators": ["what makes them unique"]
  },
  "positioning": {
    "targetAudience": "who this is for",
    "valueProposition": "their main promise",
    "socialProof": ["customer1", "backed by X"]
  },
  "insights": ["insight1", "insight2", "insight3"],
  "integrations": ["integration1"],
  "security": ["SOC2", "GDPR"],
  "summary": "2-3 sentence executive summary of what this competitor offers and their strategy"
}

IMPORTANT: 
- Return ONLY valid JSON, no markdown blocks
- If something is not visible, use null or empty array
- Be specific with prices and features
- Focus on actionable intelligence`;

/**
 * Compress image buffer by reducing quality and resizing
 * Reduces file size significantly for faster API calls
 */
async function compressScreenshot(buffer: Buffer): Promise<Buffer> {
    try {
        const sharp = (await import("sharp")).default;

        // Get image metadata
        const metadata = await sharp(buffer).metadata();
        const width = metadata.width || 1440;

        // Resize aggressively for Free Tier token limits
        // Max width 1000px, Max height 2000px
        const compressed = await sharp(buffer)
            .resize({
                width: 1000,
                height: 2000,
                fit: "inside",
                withoutEnlargement: true,
            })
            .jpeg({
                quality: 60, // Lower quality to save tokens
                mozjpeg: true,
            })
            .toBuffer();

        const savings = Math.round((1 - compressed.length / buffer.length) * 100);
        console.log(`[Vision] Compressed ${buffer.length} → ${compressed.length} bytes (${savings}% smaller)`);

        return compressed;
    } catch (error) {
        console.warn("[Vision] Compression failed, using original:", error);
        return buffer;
    }
}

/**
 * Analyze a screenshot using Gemini vision
 */
export async function analyzeScreenshot(
    screenshotBuffer: Buffer,
    pageUrl?: string,
    pageTitle?: string
): Promise<VisionAnalysisResponse> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return {
            success: false,
            error: "GEMINI_API_KEY not configured",
        };
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

        // Compress screenshot
        const compressedBuffer = await compressScreenshot(screenshotBuffer);
        const base64Image = compressedBuffer.toString("base64");

        const contextHint = [
            pageUrl ? `URL: ${pageUrl}` : "",
            pageTitle ? `Title: ${pageTitle}` : "",
        ].filter(Boolean).join("\n");

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            inlineData: {
                                mimeType: "image/jpeg",
                                data: base64Image,
                            },
                        },
                        {
                            text: ANALYSIS_PROMPT + (contextHint ? `\n\nContext:\n${contextHint}` : ""),
                        },
                    ],
                },
            ],
            config: {
                maxOutputTokens: 4000,
                temperature: 0.2,
            },
        });

        const rawText = response.text || "";

        if (!rawText) {
            return {
                success: false,
                error: "Gemini returned empty response",
            };
        }

        // Try to parse JSON from response
        let parsed: CompetitorAnalysis;

        try {
            const cleanedText = rawText
                .replace(/```json\n?/g, "")
                .replace(/```\n?/g, "")
                .trim();

            parsed = JSON.parse(cleanedText);
        } catch {
            console.warn("[Vision] Failed to parse JSON, creating fallback");
            parsed = {
                companyName: "Unknown",
                pricing: { plans: [] },
                features: { highlighted: [], differentiators: [] },
                positioning: {},
                insights: [rawText.slice(0, 500)],
                summary: "Analysis returned but JSON parsing failed. Raw insights available.",
            };
        }

        return {
            success: true,
            analysis: parsed,
            rawAnalysis: rawText,
            model: "gemini-2.0-flash",
            timestamp: new Date().toISOString(),
            screenshotSize: compressedBuffer.length,
        };
    } catch (error) {
        console.error("[Vision] Analysis error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Full pipeline: capture + analyze
 */
export async function captureAndAnalyze(
    url: string
): Promise<{ screenshot: Buffer | null; analysis: VisionAnalysisResponse }> {
    const { captureScreenshot } = await import("@/lib/crawler/screenshot");

    const screenshotResult = await captureScreenshot(url);

    if (!screenshotResult.success) {
        return {
            screenshot: null,
            analysis: {
                success: false,
                error: screenshotResult.error,
            },
        };
    }

    const analysis = await analyzeScreenshot(
        screenshotResult.screenshot,
        screenshotResult.url,
        screenshotResult.title
    );

    return {
        screenshot: screenshotResult.screenshot,
        analysis,
    };
}

