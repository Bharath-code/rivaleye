import { createServerClient } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";
import type { DetectedTech, TechCategory } from "@/lib/crawler/techStackDetector";

/**
 * Tech Stack Alerts Module
 *
 * Monitors competitor tech stack changes and creates alerts
 * with semantic interpretation of what the changes mean.
 *
 * Strategy: Use hardcoded meanings for known tech, fall back to AI for unknown.
 */

// ──────────────────────────────────────────────────────────────────────────────
// SEMANTIC MEANINGS (Hardcoded for common technologies)
// ──────────────────────────────────────────────────────────────────────────────

interface TechMeaning {
    addedMessage: string;
    removedMessage: string;
    strategicImplication: string;
}

const TECH_MEANINGS: Record<string, TechMeaning> = {
    // Payment
    "Stripe": {
        addedMessage: "Added Stripe payment processing",
        removedMessage: "Removed Stripe — may be switching payment providers",
        strategicImplication: "Launching or expanding paid plans",
    },
    "Paddle": {
        addedMessage: "Added Paddle for payments",
        removedMessage: "Removed Paddle payment system",
        strategicImplication: "Setting up international payment processing",
    },
    "PayPal": {
        addedMessage: "Added PayPal payment option",
        removedMessage: "Removed PayPal",
        strategicImplication: "Expanding payment methods for broader audience",
    },

    // Analytics
    "Segment": {
        addedMessage: "Added Segment for analytics",
        removedMessage: "Removed Segment",
        strategicImplication: "Building data infrastructure for growth",
    },
    "Mixpanel": {
        addedMessage: "Added Mixpanel product analytics",
        removedMessage: "Removed Mixpanel",
        strategicImplication: "Focusing on product-led growth and user behavior",
    },
    "Amplitude": {
        addedMessage: "Added Amplitude analytics",
        removedMessage: "Removed Amplitude",
        strategicImplication: "Investing in product analytics at scale",
    },
    "PostHog": {
        addedMessage: "Added PostHog analytics",
        removedMessage: "Removed PostHog",
        strategicImplication: "Building self-hosted analytics stack",
    },
    "Hotjar": {
        addedMessage: "Added Hotjar for heatmaps",
        removedMessage: "Removed Hotjar",
        strategicImplication: "Analyzing user behavior and UX patterns",
    },

    // Chat/Support
    "Intercom": {
        addedMessage: "Added Intercom for customer messaging",
        removedMessage: "Removed Intercom",
        strategicImplication: "Scaling customer support and sales automation",
    },
    "Drift": {
        addedMessage: "Added Drift conversational marketing",
        removedMessage: "Removed Drift",
        strategicImplication: "Investing in sales-led growth",
    },
    "Crisp": {
        addedMessage: "Added Crisp chat widget",
        removedMessage: "Removed Crisp",
        strategicImplication: "Adding live chat for customer support",
    },

    // Frameworks
    "Next.js": {
        addedMessage: "Migrated to Next.js framework",
        removedMessage: "Moving away from Next.js",
        strategicImplication: "Investing in performance and SEO",
    },
    "React": {
        addedMessage: "Using React frontend",
        removedMessage: "Moving away from React",
        strategicImplication: "Standard modern frontend stack",
    },
    "Vue.js": {
        addedMessage: "Using Vue.js frontend",
        removedMessage: "Moving away from Vue.js",
        strategicImplication: "Progressive frontend approach",
    },

    // Auth
    "Auth0": {
        addedMessage: "Added Auth0 authentication",
        removedMessage: "Removed Auth0",
        strategicImplication: "Enterprise-grade authentication setup",
    },
    "Clerk": {
        addedMessage: "Added Clerk authentication",
        removedMessage: "Removed Clerk",
        strategicImplication: "Modern auth with social login support",
    },

    // Monitoring
    "Sentry": {
        addedMessage: "Added Sentry error tracking",
        removedMessage: "Removed Sentry",
        strategicImplication: "Improving product reliability",
    },
    "LogRocket": {
        addedMessage: "Added LogRocket session replay",
        removedMessage: "Removed LogRocket",
        strategicImplication: "Debugging UX issues at scale",
    },
    "Datadog": {
        addedMessage: "Added Datadog monitoring",
        removedMessage: "Removed Datadog",
        strategicImplication: "Enterprise-level infrastructure monitoring",
    },

    // Marketing
    "HubSpot": {
        addedMessage: "Added HubSpot CRM/marketing",
        removedMessage: "Removed HubSpot",
        strategicImplication: "Scaling marketing automation",
    },
    "ConvertKit": {
        addedMessage: "Added ConvertKit email marketing",
        removedMessage: "Removed ConvertKit",
        strategicImplication: "Building creator/newsletter focused growth",
    },
    "Mailchimp": {
        addedMessage: "Added Mailchimp email marketing",
        removedMessage: "Removed Mailchimp",
        strategicImplication: "Setting up email marketing campaigns",
    },

    // Hosting
    "Vercel": {
        addedMessage: "Deployed on Vercel",
        removedMessage: "Moving away from Vercel",
        strategicImplication: "Optimizing for edge performance",
    },
    "Netlify": {
        addedMessage: "Deployed on Netlify",
        removedMessage: "Moving away from Netlify",
        strategicImplication: "JAMstack deployment approach",
    },
    "Cloudflare": {
        addedMessage: "Using Cloudflare CDN",
        removedMessage: "Removed Cloudflare",
        strategicImplication: "Improving global performance and security",
    },
};

// ──────────────────────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────────────────────

export interface TechStackAlertData {
    type: "added" | "removed";
    techName: string;
    category: TechCategory;
    message: string;
    strategicImplication: string;
    severity: "high" | "medium" | "low";
    aiGenerated?: boolean; // Flag if AI was used
}

// ──────────────────────────────────────────────────────────────────────────────
// AI-POWERED SEMANTIC GENERATION
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Use Gemini AI to generate strategic meaning for unknown technologies.
 */
async function generateAISemanticMeaning(
    techName: string,
    category: TechCategory,
    added: boolean
): Promise<TechMeaning | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    try {
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `You are a competitive intelligence expert analyzing SaaS companies.

CONTEXT: A competitor ${added ? "added" : "removed"} a technology called "${techName}" (category: ${category}).

Provide a brief, actionable analysis in JSON format:
{
  "${added ? "addedMessage" : "removedMessage"}": "Brief description of the change (1 line)",
  "strategicImplication": "What this means strategically for the competitor and opportunity for you (1 line)"
}

Be specific and insightful. Examples:
- "Added Lemon Squeezy" → "Setting up creator-focused payment processing"
- "Added Plausible" → "Switching to privacy-focused analytics"
- "Added Supabase" → "Building modern backend infrastructure"

Return ONLY valid JSON, no markdown.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                maxOutputTokens: 200,
                temperature: 0.3,
            },
        });

        const rawText = response.text || "";
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        const result = JSON.parse(jsonMatch[0]);
        return {
            addedMessage: result.addedMessage || `Added ${techName}`,
            removedMessage: result.removedMessage || `Removed ${techName}`,
            strategicImplication: result.strategicImplication || `Change in ${category} approach`,
        };
    } catch (error) {
        console.error("[TechStackAlerts] AI generation failed:", error);
        return null;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// ALERT GENERATION
// ──────────────────────────────────────────────────────────────────────────────

function getSeverity(category: TechCategory): "high" | "medium" | "low" {
    switch (category) {
        case "payment":
            return "high"; // Payment changes are critical
        case "analytics":
        case "marketing":
        case "chat":
            return "medium";
        default:
            return "low";
    }
}

function getDefaultMeaning(tech: DetectedTech, added: boolean): TechMeaning {
    return {
        addedMessage: `Added ${tech.name}`,
        removedMessage: `Removed ${tech.name}`,
        strategicImplication: added
            ? `Investing in ${tech.category} capabilities`
            : `Changing ${tech.category} approach`,
    };
}

/**
 * Analyze tech stack changes and generate meaningful alerts.
 * Uses hardcoded meanings first, falls back to AI for unknown tech.
 */
export async function analyzeTechStackChanges(
    oldTech: DetectedTech[],
    newTech: DetectedTech[]
): Promise<TechStackAlertData[]> {
    const alerts: TechStackAlertData[] = [];

    const oldNames = new Set(oldTech.map((t) => t.name));
    const newNames = new Set(newTech.map((t) => t.name));

    // Check for added technologies
    for (const tech of newTech) {
        if (!oldNames.has(tech.name)) {
            let meaning = TECH_MEANINGS[tech.name];
            let aiGenerated = false;

            // If not in hardcoded list, try AI
            if (!meaning) {
                const aiMeaning = await generateAISemanticMeaning(tech.name, tech.category, true);
                if (aiMeaning) {
                    meaning = aiMeaning;
                    aiGenerated = true;
                } else {
                    meaning = getDefaultMeaning(tech, true);
                }
            }

            alerts.push({
                type: "added",
                techName: tech.name,
                category: tech.category,
                message: meaning.addedMessage,
                strategicImplication: meaning.strategicImplication,
                severity: getSeverity(tech.category),
                aiGenerated,
            });
        }
    }

    // Check for removed technologies
    for (const tech of oldTech) {
        if (!newNames.has(tech.name)) {
            let meaning = TECH_MEANINGS[tech.name];
            let aiGenerated = false;

            // If not in hardcoded list, try AI
            if (!meaning) {
                const aiMeaning = await generateAISemanticMeaning(tech.name, tech.category, false);
                if (aiMeaning) {
                    meaning = aiMeaning;
                    aiGenerated = true;
                } else {
                    meaning = getDefaultMeaning(tech, false);
                }
            }

            alerts.push({
                type: "removed",
                techName: tech.name,
                category: tech.category,
                message: meaning.removedMessage,
                strategicImplication: meaning.strategicImplication,
                severity: getSeverity(tech.category),
                aiGenerated,
            });
        }
    }

    return alerts;
}

/**
 * Create tech stack alerts in the database.
 */
export async function createTechStackAlerts(
    userId: string,
    competitorId: string,
    competitorName: string,
    alerts: TechStackAlertData[]
): Promise<void> {
    if (alerts.length === 0) return;

    const supabase = createServerClient();

    for (const alert of alerts) {
        const icon = alert.type === "added" ? "➕" : "➖";

        await supabase.from("alerts").insert({
            user_id: userId,
            competitor_id: competitorId,
            title: `${competitorName}: ${icon} ${alert.techName}`,
            message: `${alert.message}. Strategic implication: ${alert.strategicImplication}`,
            severity: alert.severity,
            type: "TECH_STACK_CHANGE",
            metadata: {
                techName: alert.techName,
                category: alert.category,
                changeType: alert.type,
                strategicImplication: alert.strategicImplication,
            },
            read: false,
            created_at: new Date().toISOString(),
        });
    }
}

/**
 * Format alerts for email/Slack notification.
 */
export function formatTechStackAlertsForNotification(
    competitorName: string,
    alerts: TechStackAlertData[]
): string {
    if (alerts.length === 0) return "";

    const lines = [`🔧 Tech stack changes detected for ${competitorName}:`, ""];

    // Group by type
    const added = alerts.filter((a) => a.type === "added");
    const removed = alerts.filter((a) => a.type === "removed");

    if (added.length > 0) {
        lines.push("**Added:**");
        for (const a of added) {
            lines.push(`  ➕ ${a.message}`);
            lines.push(`     💡 ${a.strategicImplication}`);
        }
        lines.push("");
    }

    if (removed.length > 0) {
        lines.push("**Removed:**");
        for (const a of removed) {
            lines.push(`  ➖ ${a.message}`);
        }
    }

    return lines.join("\n");
}
