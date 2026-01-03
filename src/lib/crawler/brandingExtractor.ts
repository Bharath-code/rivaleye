import FirecrawlApp from "@mendable/firecrawl-js";

/**
 * Branding Extractor Module
 *
 * Uses Firecrawl's branding format to extract competitor's design system:
 * - Color palette (primary, secondary, accent, background)
 * - Typography (fonts, sizes, weights)
 * - Component styles (buttons, spacing, border-radius)
 * - Brand assets (logo, favicon, og-image)
 *
 * This is a PRO-ONLY feature.
 */

// ──────────────────────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────────────────────

export interface BrandingColors {
    primary: string | null;
    secondary: string | null;
    accent: string | null;
    background: string | null;
    textPrimary: string | null;
    textSecondary: string | null;
}

export interface BrandingTypography {
    fontFamilies: {
        primary: string | null;
        heading: string | null;
        code: string | null;
    };
    fontSizes: {
        h1: string | null;
        h2: string | null;
        h3: string | null;
        body: string | null;
    };
    fontWeights: {
        regular: number | null;
        medium: number | null;
        bold: number | null;
    };
}

export interface BrandingComponents {
    buttonPrimary: {
        background: string | null;
        textColor: string | null;
        borderRadius: string | null;
    } | null;
    buttonSecondary: {
        background: string | null;
        textColor: string | null;
        borderColor: string | null;
        borderRadius: string | null;
    } | null;
}

export interface BrandingAssets {
    logo: string | null;
    favicon: string | null;
    ogImage: string | null;
}

export interface ExtractedBranding {
    colorScheme: "dark" | "light" | "unknown";
    colors: BrandingColors;
    fonts: string[];
    typography: BrandingTypography;
    spacing: {
        baseUnit: number | null;
        borderRadius: string | null;
    };
    components: BrandingComponents;
    assets: BrandingAssets;
    extractedAt: string;
}

export interface BrandingExtractionResult {
    success: true;
    branding: ExtractedBranding;
    url: string;
}

export interface BrandingExtractionError {
    success: false;
    error: string;
    code: "API_ERROR" | "NO_BRANDING" | "RATE_LIMITED" | "UNKNOWN";
}

export type BrandingExtractionResponse = BrandingExtractionResult | BrandingExtractionError;

// ──────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ──────────────────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 30000;

function getFirecrawlClient(): FirecrawlApp {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
        throw new Error("Missing FIRECRAWL_API_KEY environment variable");
    }
    return new FirecrawlApp({ apiKey });
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN EXTRACTION FUNCTION
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Extract branding/design system from a competitor's website.
 * Uses Firecrawl's branding format.
 *
 * @param url - The URL to extract branding from (usually homepage)
 */
export async function extractBranding(url: string): Promise<BrandingExtractionResponse> {
    try {
        const client = getFirecrawlClient();

        // Timeout wrapper
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT_MS);
        });

        // Firecrawl scrape with branding format
        const scrapePromise = client.scrape(url, {
            formats: ["branding" as never], // Type assertion for SDK compatibility
        });

        const result = await Promise.race([scrapePromise, timeoutPromise]);

        if (!result) {
            return {
                success: false,
                error: "Firecrawl returned empty response",
                code: "API_ERROR",
            };
        }

        // Extract branding data from response
        const brandingData = (result as Record<string, unknown>).branding;

        if (!brandingData || typeof brandingData !== "object") {
            return {
                success: false,
                error: "No branding data found in response",
                code: "NO_BRANDING",
            };
        }

        // Parse and normalize the branding response
        const branding = normalizeBrandingResponse(brandingData as Record<string, unknown>);

        return {
            success: true,
            branding,
            url,
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";

        if (message === "TIMEOUT") {
            return {
                success: false,
                error: "Request timed out after 30 seconds",
                code: "API_ERROR",
            };
        }

        if (message.includes("429") || message.includes("rate limit")) {
            return {
                success: false,
                error: "Rate limited by Firecrawl",
                code: "RATE_LIMITED",
            };
        }

        return {
            success: false,
            error: message,
            code: "UNKNOWN",
        };
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// RESPONSE NORMALIZATION
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Normalize Firecrawl's branding response into our standard format.
 */
function normalizeBrandingResponse(raw: Record<string, unknown>): ExtractedBranding {
    const colors = raw.colors as Record<string, string> | undefined;
    const typography = raw.typography as Record<string, unknown> | undefined;
    const fonts = raw.fonts as Array<{ family?: string }> | undefined;
    const spacing = raw.spacing as Record<string, unknown> | undefined;
    const components = raw.components as Record<string, unknown> | undefined;
    const images = raw.images as Record<string, string> | undefined;

    return {
        colorScheme: (raw.colorScheme as "dark" | "light") || "unknown",
        colors: {
            primary: colors?.primary || null,
            secondary: colors?.secondary || null,
            accent: colors?.accent || null,
            background: colors?.background || null,
            textPrimary: colors?.textPrimary || null,
            textSecondary: colors?.textSecondary || null,
        },
        fonts: fonts?.map((f) => f.family || "").filter(Boolean) || [],
        typography: {
            fontFamilies: {
                primary: (typography?.fontFamilies as Record<string, string>)?.primary || null,
                heading: (typography?.fontFamilies as Record<string, string>)?.heading || null,
                code: (typography?.fontFamilies as Record<string, string>)?.code || null,
            },
            fontSizes: {
                h1: (typography?.fontSizes as Record<string, string>)?.h1 || null,
                h2: (typography?.fontSizes as Record<string, string>)?.h2 || null,
                h3: (typography?.fontSizes as Record<string, string>)?.h3 || null,
                body: (typography?.fontSizes as Record<string, string>)?.body || null,
            },
            fontWeights: {
                regular: (typography?.fontWeights as Record<string, number>)?.regular || null,
                medium: (typography?.fontWeights as Record<string, number>)?.medium || null,
                bold: (typography?.fontWeights as Record<string, number>)?.bold || null,
            },
        },
        spacing: {
            baseUnit: (spacing?.baseUnit as number) || null,
            borderRadius: (spacing?.borderRadius as string) || null,
        },
        components: {
            buttonPrimary: components?.buttonPrimary
                ? {
                    background: (components.buttonPrimary as Record<string, string>).background || null,
                    textColor: (components.buttonPrimary as Record<string, string>).textColor || null,
                    borderRadius: (components.buttonPrimary as Record<string, string>).borderRadius || null,
                }
                : null,
            buttonSecondary: components?.buttonSecondary
                ? {
                    background: (components.buttonSecondary as Record<string, string>).background || null,
                    textColor: (components.buttonSecondary as Record<string, string>).textColor || null,
                    borderColor: (components.buttonSecondary as Record<string, string>).borderColor || null,
                    borderRadius: (components.buttonSecondary as Record<string, string>).borderRadius || null,
                }
                : null,
        },
        assets: {
            logo: images?.logo || (raw.logo as string) || null,
            favicon: images?.favicon || null,
            ogImage: images?.ogImage || null,
        },
        extractedAt: new Date().toISOString(),
    };
}

// ──────────────────────────────────────────────────────────────────────────────
// BRANDING COMPARISON
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compare two branding extractions to detect design changes.
 */
export function compareBranding(
    oldBranding: ExtractedBranding,
    newBranding: ExtractedBranding
): BrandingDiff {
    const changes: BrandingChange[] = [];

    // Compare colors
    for (const colorKey of Object.keys(newBranding.colors) as Array<keyof BrandingColors>) {
        const oldColor = oldBranding.colors[colorKey];
        const newColor = newBranding.colors[colorKey];
        if (oldColor !== newColor) {
            changes.push({
                type: "color",
                field: colorKey,
                oldValue: oldColor,
                newValue: newColor,
            });
        }
    }

    // Compare fonts
    const oldFonts = oldBranding.fonts.sort().join(",");
    const newFonts = newBranding.fonts.sort().join(",");
    if (oldFonts !== newFonts) {
        changes.push({
            type: "typography",
            field: "fonts",
            oldValue: oldBranding.fonts.join(", "),
            newValue: newBranding.fonts.join(", "),
        });
    }

    // Compare color scheme
    if (oldBranding.colorScheme !== newBranding.colorScheme) {
        changes.push({
            type: "theme",
            field: "colorScheme",
            oldValue: oldBranding.colorScheme,
            newValue: newBranding.colorScheme,
        });
    }

    // Compare logo
    if (oldBranding.assets.logo !== newBranding.assets.logo) {
        changes.push({
            type: "asset",
            field: "logo",
            oldValue: oldBranding.assets.logo,
            newValue: newBranding.assets.logo,
        });
    }

    return {
        hasChanges: changes.length > 0,
        changes,
        summary: summarizeChanges(changes),
    };
}

export interface BrandingChange {
    type: "color" | "typography" | "theme" | "asset" | "spacing";
    field: string;
    oldValue: string | number | null;
    newValue: string | number | null;
}

export interface BrandingDiff {
    hasChanges: boolean;
    changes: BrandingChange[];
    summary: string;
}

function summarizeChanges(changes: BrandingChange[]): string {
    if (changes.length === 0) return "No branding changes detected";

    const types = [...new Set(changes.map((c) => c.type))];

    if (types.includes("theme")) {
        return "Major rebrand detected: color scheme changed";
    }

    if (types.includes("asset")) {
        return "Brand asset update: logo or images changed";
    }

    if (types.includes("color") && types.includes("typography")) {
        return "Design system refresh: colors and typography updated";
    }

    if (types.includes("color")) {
        return `Color palette update: ${changes.filter((c) => c.type === "color").length} colors changed`;
    }

    if (types.includes("typography")) {
        return "Typography update: fonts changed";
    }

    return `${changes.length} branding changes detected`;
}
