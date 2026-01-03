import { createServerClient } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";
import type { ExtractedBranding, BrandingColors } from "@/lib/crawler/brandingExtractor";

/**
 * Branding Alerts Module
 *
 * Monitors competitor branding changes and creates alerts
 * with semantic interpretation of what changes mean.
 *
 * Uses AI to enhance strategic insights for complex changes.
 */

// ──────────────────────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────────────────────

export interface BrandingAlertData {
    type: "color_change" | "font_change" | "theme_change" | "logo_change" | "refresh";
    changeDescription: string;
    strategicImplication: string;
    severity: "high" | "medium" | "low";
    details: {
        field: string;
        oldValue: string | null;
        newValue: string | null;
    };
    aiGenerated?: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// SEMANTIC INTERPRETATIONS (hardcoded for common patterns)
// ──────────────────────────────────────────────────────────────────────────────

const BRANDING_IMPLICATIONS = {
    theme_change: {
        "dark_to_light": "Moving to a lighter, more accessible brand image",
        "light_to_dark": "Adopting a sleek, modern dark theme — premium positioning",
    },
    primary_color: "Primary brand color change signals potential rebrand",
    accent_color: "Accent color tweak — likely minor design refresh",
    logo: "New logo detected — major brand overhaul likely incoming",
    fonts: "Typography change — design system refresh in progress",
    multiple_colors: "Multiple color changes — significant brand refresh",
};

// ──────────────────────────────────────────────────────────────────────────────
// AI-ENHANCED STRATEGIC INSIGHTS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Use Gemini AI to generate enhanced strategic insights for branding changes.
 */
async function generateAIBrandingInsight(
    changeType: string,
    description: string,
    oldValue: string | null,
    newValue: string | null
): Promise<string | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    try {
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `You are a brand strategist analyzing a competitor's website.

CHANGE DETECTED: ${changeType}
DESCRIPTION: ${description}
OLD VALUE: ${oldValue || "none"}
NEW VALUE: ${newValue || "none"}

Provide ONE sentence (max 15 words) explaining what this change means strategically for the competitor.
Focus on: market positioning, target audience shift, competitive moves.

Examples:
- "Dark theme suggests premium B2B pivot targeting enterprise customers"
- "Warmer color palette indicates shift toward consumer-friendly positioning"
- "Sans-serif font change signals modern tech startup rebrand"

Return ONLY the strategic insight sentence, no quotes or formatting.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                maxOutputTokens: 50,
                temperature: 0.3,
            },
        });

        const insight = response.text?.trim();
        return insight && insight.length > 10 ? insight : null;
    } catch (error) {
        console.error("[BrandingAlerts] AI generation failed:", error);
        return null;
    }
}


// ──────────────────────────────────────────────────────────────────────────────
// COLOR ANALYSIS
// ──────────────────────────────────────────────────────────────────────────────

function colorDistance(color1: string | null, color2: string | null): number {
    if (!color1 || !color2) return color1 === color2 ? 0 : 100;

    // Simple string comparison for major changes
    // Could be enhanced with actual color distance calculation
    return color1.toLowerCase() === color2.toLowerCase() ? 0 : 50;
}

function analyzeColorChanges(
    oldColors: BrandingColors,
    newColors: BrandingColors
): BrandingAlertData[] {
    const alerts: BrandingAlertData[] = [];
    const colorChanges: string[] = [];

    // Check each color property
    const colorKeys: Array<keyof BrandingColors> = [
        "primary", "secondary", "accent", "background", "textPrimary", "textSecondary"
    ];

    for (const key of colorKeys) {
        const oldColor = oldColors[key];
        const newColor = newColors[key];

        if (oldColor !== newColor && (oldColor || newColor)) {
            colorChanges.push(key);

            // Primary color change is significant
            if (key === "primary") {
                alerts.push({
                    type: "color_change",
                    changeDescription: `Primary brand color changed from ${oldColor || "none"} to ${newColor || "none"}`,
                    strategicImplication: BRANDING_IMPLICATIONS.primary_color,
                    severity: "high",
                    details: { field: "primary_color", oldValue: oldColor, newValue: newColor },
                });
            }
        }
    }

    // Multiple color changes = brand refresh
    if (colorChanges.length >= 3 && !alerts.some((a) => a.type === "refresh")) {
        alerts.push({
            type: "refresh",
            changeDescription: `Multiple colors changed: ${colorChanges.join(", ")}`,
            strategicImplication: BRANDING_IMPLICATIONS.multiple_colors,
            severity: "high",
            details: { field: "color_palette", oldValue: "previous palette", newValue: "new palette" },
        });
    }

    return alerts;
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN ANALYSIS FUNCTION
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Analyze branding changes and generate meaningful alerts.
 */
export function analyzeBrandingChanges(
    oldBranding: ExtractedBranding,
    newBranding: ExtractedBranding
): BrandingAlertData[] {
    const alerts: BrandingAlertData[] = [];

    // Check theme/color scheme change
    if (oldBranding.colorScheme !== newBranding.colorScheme) {
        const themeKey = `${oldBranding.colorScheme}_to_${newBranding.colorScheme}` as keyof typeof BRANDING_IMPLICATIONS.theme_change;
        const implication = BRANDING_IMPLICATIONS.theme_change[themeKey] ||
            `Theme changed from ${oldBranding.colorScheme} to ${newBranding.colorScheme}`;

        alerts.push({
            type: "theme_change",
            changeDescription: `Color scheme changed from ${oldBranding.colorScheme} to ${newBranding.colorScheme}`,
            strategicImplication: implication,
            severity: "high",
            details: {
                field: "colorScheme",
                oldValue: oldBranding.colorScheme,
                newValue: newBranding.colorScheme,
            },
        });
    }

    // Check color changes
    const colorAlerts = analyzeColorChanges(oldBranding.colors, newBranding.colors);
    alerts.push(...colorAlerts);

    // Check font changes
    const oldFonts = oldBranding.fonts.sort().join(",");
    const newFonts = newBranding.fonts.sort().join(",");
    if (oldFonts !== newFonts) {
        const addedFonts = newBranding.fonts.filter((f) => !oldBranding.fonts.includes(f));
        const removedFonts = oldBranding.fonts.filter((f) => !newBranding.fonts.includes(f));

        let description = "Typography changed";
        if (addedFonts.length > 0) description += ` — added: ${addedFonts.join(", ")}`;
        if (removedFonts.length > 0) description += ` — removed: ${removedFonts.join(", ")}`;

        alerts.push({
            type: "font_change",
            changeDescription: description,
            strategicImplication: BRANDING_IMPLICATIONS.fonts,
            severity: "medium",
            details: {
                field: "fonts",
                oldValue: oldBranding.fonts.join(", ") || "none",
                newValue: newBranding.fonts.join(", ") || "none",
            },
        });
    }

    // Check logo change
    if (oldBranding.assets.logo !== newBranding.assets.logo &&
        (oldBranding.assets.logo || newBranding.assets.logo)) {
        alerts.push({
            type: "logo_change",
            changeDescription: "Logo updated or changed",
            strategicImplication: BRANDING_IMPLICATIONS.logo,
            severity: "high",
            details: {
                field: "logo",
                oldValue: oldBranding.assets.logo,
                newValue: newBranding.assets.logo,
            },
        });
    }

    return alerts;
}

/**
 * Create branding alerts in the database.
 */
export async function createBrandingAlerts(
    userId: string,
    competitorId: string,
    competitorName: string,
    alerts: BrandingAlertData[]
): Promise<void> {
    if (alerts.length === 0) return;

    const supabase = createServerClient();

    for (const alert of alerts) {
        const icon = getAlertIcon(alert.type);

        await supabase.from("alerts").insert({
            user_id: userId,
            competitor_id: competitorId,
            title: `${competitorName}: ${icon} ${getAlertTitle(alert.type)}`,
            message: `${alert.changeDescription}. ${alert.strategicImplication}`,
            severity: alert.severity,
            type: "BRANDING_CHANGE",
            metadata: {
                changeType: alert.type,
                field: alert.details.field,
                oldValue: alert.details.oldValue,
                newValue: alert.details.newValue,
                strategicImplication: alert.strategicImplication,
            },
            read: false,
            created_at: new Date().toISOString(),
        });
    }
}

function getAlertIcon(type: BrandingAlertData["type"]): string {
    switch (type) {
        case "color_change": return "🎨";
        case "font_change": return "✏️";
        case "theme_change": return "🌓";
        case "logo_change": return "🖼️";
        case "refresh": return "🔄";
        default: return "🎨";
    }
}

function getAlertTitle(type: BrandingAlertData["type"]): string {
    switch (type) {
        case "color_change": return "Color Change";
        case "font_change": return "Typography Update";
        case "theme_change": return "Theme Changed";
        case "logo_change": return "New Logo";
        case "refresh": return "Brand Refresh";
        default: return "Branding Change";
    }
}

/**
 * Format alerts for email/Slack notification.
 */
export function formatBrandingAlertsForNotification(
    competitorName: string,
    alerts: BrandingAlertData[]
): string {
    if (alerts.length === 0) return "";

    const lines = [`🎨 Branding changes detected for ${competitorName}:`, ""];

    for (const alert of alerts) {
        const icon = getAlertIcon(alert.type);
        lines.push(`${icon} ${alert.changeDescription}`);
        lines.push(`   💡 ${alert.strategicImplication}`);
        lines.push("");
    }

    // Add tip for major changes
    const majorChanges = alerts.filter((a) => a.severity === "high");
    if (majorChanges.length > 0) {
        lines.push("⚠️ Major branding changes may indicate a rebrand or repositioning!");
    }

    return lines.join("\n");
}
