import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

/**
 * Tech Stack Detector Module
 *
 * Analyzes competitor websites to detect:
 * - Frontend frameworks (React, Vue, Angular, Next.js, etc.)
 * - Analytics tools (Google Analytics, Segment, Mixpanel)
 * - Marketing tools (Intercom, HubSpot, Drift)
 * - CDNs and hosting (Cloudflare, Vercel, AWS)
 * - Payment processors (Stripe, Paddle, PayPal)
 * - CMS platforms (WordPress, Webflow, Contentful)
 *
 * This is a PRO-ONLY feature.
 */

// ──────────────────────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────────────────────

export interface DetectedTech {
    name: string;
    category: TechCategory;
    confidence: "high" | "medium" | "low";
    evidence: string;
}

export type TechCategory =
    | "framework"
    | "analytics"
    | "marketing"
    | "cdn"
    | "hosting"
    | "payment"
    | "cms"
    | "auth"
    | "database"
    | "monitoring"
    | "chat"
    | "email"
    | "other";

export interface TechStackResult {
    success: true;
    technologies: DetectedTech[];
    summary: TechStackSummary;
    extractedAt: string;
}

export interface TechStackSummary {
    framework: string | null;
    analytics: string[];
    payments: string[];
    marketing: string[];
    hosting: string | null;
}

export interface TechStackError {
    success: false;
    error: string;
    code: "TIMEOUT" | "BLOCKED" | "UNKNOWN";
}

export type TechStackResponse = TechStackResult | TechStackError;

// ──────────────────────────────────────────────────────────────────────────────
// TECH SIGNATURES
// ──────────────────────────────────────────────────────────────────────────────

interface TechSignature {
    name: string;
    category: TechCategory;
    patterns: {
        scripts?: RegExp[];
        meta?: RegExp[];
        globals?: string[];
        html?: RegExp[];
        headers?: RegExp[];
    };
}

const TECH_SIGNATURES: TechSignature[] = [
    // Frameworks
    {
        name: "Next.js",
        category: "framework",
        patterns: {
            scripts: [/_next\/static/],
            meta: [/next-head-count/],
            globals: ["__NEXT_DATA__"],
        },
    },
    {
        name: "React",
        category: "framework",
        patterns: {
            scripts: [/react\.production\.min\.js/, /react-dom/],
            globals: ["__REACT_DEVTOOLS_GLOBAL_HOOK__"],
            html: [/data-reactroot/, /data-reactid/],
        },
    },
    {
        name: "Vue.js",
        category: "framework",
        patterns: {
            scripts: [/vue\.min\.js/, /vue\.runtime/],
            globals: ["__VUE__", "Vue"],
            html: [/data-v-[a-f0-9]+/],
        },
    },
    {
        name: "Angular",
        category: "framework",
        patterns: {
            scripts: [/angular\.min\.js/, /@angular\/core/],
            html: [/ng-version/, /ng-app/],
        },
    },
    {
        name: "Nuxt.js",
        category: "framework",
        patterns: {
            scripts: [/_nuxt\//],
            globals: ["__NUXT__"],
        },
    },
    {
        name: "Svelte",
        category: "framework",
        patterns: {
            html: [/class="svelte-[a-z0-9]+"/],
        },
    },

    // Analytics
    {
        name: "Google Analytics",
        category: "analytics",
        patterns: {
            scripts: [/google-analytics\.com/, /googletagmanager\.com/, /gtag\//],
            globals: ["ga", "gtag", "dataLayer"],
        },
    },
    {
        name: "Segment",
        category: "analytics",
        patterns: {
            scripts: [/cdn\.segment\.com/],
            globals: ["analytics"],
        },
    },
    {
        name: "Mixpanel",
        category: "analytics",
        patterns: {
            scripts: [/cdn\.mxpnl\.com/, /mixpanel/],
            globals: ["mixpanel"],
        },
    },
    {
        name: "Amplitude",
        category: "analytics",
        patterns: {
            scripts: [/amplitude\.com/],
            globals: ["amplitude"],
        },
    },
    {
        name: "Hotjar",
        category: "analytics",
        patterns: {
            scripts: [/static\.hotjar\.com/],
            globals: ["hj"],
        },
    },
    {
        name: "PostHog",
        category: "analytics",
        patterns: {
            scripts: [/posthog\.com/, /app\.posthog\.com/],
            globals: ["posthog"],
        },
    },

    // Marketing & Chat
    {
        name: "Intercom",
        category: "chat",
        patterns: {
            scripts: [/widget\.intercom\.io/],
            globals: ["Intercom"],
        },
    },
    {
        name: "Drift",
        category: "chat",
        patterns: {
            scripts: [/drift\.com/],
            globals: ["drift"],
        },
    },
    {
        name: "HubSpot",
        category: "marketing",
        patterns: {
            scripts: [/js\.hs-scripts\.com/, /hubspot\.com/],
            globals: ["HubSpot", "_hsq"],
        },
    },
    {
        name: "Crisp",
        category: "chat",
        patterns: {
            scripts: [/client\.crisp\.chat/],
            globals: ["$crisp"],
        },
    },

    // Payment
    {
        name: "Stripe",
        category: "payment",
        patterns: {
            scripts: [/js\.stripe\.com/],
            globals: ["Stripe"],
        },
    },
    {
        name: "Paddle",
        category: "payment",
        patterns: {
            scripts: [/cdn\.paddle\.com/],
            globals: ["Paddle"],
        },
    },
    {
        name: "PayPal",
        category: "payment",
        patterns: {
            scripts: [/paypal\.com\/sdk/],
            globals: ["paypal"],
        },
    },

    // CDN & Hosting
    {
        name: "Cloudflare",
        category: "cdn",
        patterns: {
            scripts: [/cloudflare/],
            headers: [/cf-ray/i],
        },
    },
    {
        name: "Vercel",
        category: "hosting",
        patterns: {
            headers: [/x-vercel/i],
            meta: [/vercel/i],
        },
    },
    {
        name: "Netlify",
        category: "hosting",
        patterns: {
            headers: [/x-nf/i, /netlify/i],
        },
    },
    {
        name: "AWS CloudFront",
        category: "cdn",
        patterns: {
            headers: [/x-amz-cf/i, /cloudfront/i],
        },
    },

    // CMS
    {
        name: "WordPress",
        category: "cms",
        patterns: {
            html: [/wp-content/, /wp-includes/],
            meta: [/wordpress/i],
        },
    },
    {
        name: "Webflow",
        category: "cms",
        patterns: {
            html: [/webflow/],
            meta: [/webflow/i],
        },
    },
    {
        name: "Contentful",
        category: "cms",
        patterns: {
            scripts: [/contentful/],
        },
    },

    // Auth
    {
        name: "Auth0",
        category: "auth",
        patterns: {
            scripts: [/auth0\.com/],
            globals: ["auth0"],
        },
    },
    {
        name: "Clerk",
        category: "auth",
        patterns: {
            scripts: [/clerk\.com/],
            globals: ["Clerk"],
        },
    },

    // Monitoring
    {
        name: "Sentry",
        category: "monitoring",
        patterns: {
            scripts: [/sentry\.io/, /browser\.sentry-cdn\.com/],
            globals: ["Sentry"],
        },
    },
    {
        name: "LogRocket",
        category: "monitoring",
        patterns: {
            scripts: [/logrocket/],
            globals: ["LogRocket"],
        },
    },
    {
        name: "Datadog",
        category: "monitoring",
        patterns: {
            scripts: [/datadoghq\.com/],
            globals: ["DD_RUM"],
        },
    },

    // Email
    {
        name: "Mailchimp",
        category: "email",
        patterns: {
            scripts: [/mailchimp\.com/],
            html: [/mc-embedded/],
        },
    },
    {
        name: "ConvertKit",
        category: "email",
        patterns: {
            scripts: [/convertkit\.com/],
        },
    },
];

// ──────────────────────────────────────────────────────────────────────────────
// BROWSER MANAGEMENT
// ──────────────────────────────────────────────────────────────────────────────

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
    if (!browserInstance || !browserInstance.isConnected()) {
        browserInstance = await chromium.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
    }
    return browserInstance;
}

export async function closeTechStackBrowser(): Promise<void> {
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN DETECTION FUNCTION
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Detect tech stack used by a competitor website.
 */
export async function detectTechStack(url: string): Promise<TechStackResponse> {
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
        const browser = await getBrowser();
        context = await browser.newContext();
        page = await context.newPage();

        // Capture network requests for script detection
        const scripts: string[] = [];
        page.on("request", (request) => {
            if (request.resourceType() === "script") {
                scripts.push(request.url());
            }
        });

        // Navigate
        const response = await page.goto(url, {
            timeout: 30000,
            waitUntil: "domcontentloaded",
        });

        // Wait for JS to load
        await page.waitForTimeout(3000);

        // Get response headers
        const headers = response?.headers() || {};

        // Get HTML content
        const html = await page.content();

        // Get global variables
        const globals = await page.evaluate(() => {
            return Object.keys(window);
        });

        // Detect technologies
        const detected: DetectedTech[] = [];

        for (const sig of TECH_SIGNATURES) {
            const matches: string[] = [];

            // Check scripts
            if (sig.patterns.scripts) {
                for (const pattern of sig.patterns.scripts) {
                    const match = scripts.find((s) => pattern.test(s));
                    if (match) matches.push(`Script: ${match.slice(0, 50)}`);
                }
            }

            // Check HTML
            if (sig.patterns.html) {
                for (const pattern of sig.patterns.html) {
                    if (pattern.test(html)) {
                        matches.push(`HTML pattern: ${pattern.source}`);
                    }
                }
            }

            // Check meta tags
            if (sig.patterns.meta) {
                for (const pattern of sig.patterns.meta) {
                    if (pattern.test(html)) {
                        matches.push(`Meta: ${pattern.source}`);
                    }
                }
            }

            // Check globals
            if (sig.patterns.globals) {
                for (const g of sig.patterns.globals) {
                    if (globals.includes(g)) {
                        matches.push(`Global: ${g}`);
                    }
                }
            }

            // Check headers
            if (sig.patterns.headers) {
                for (const pattern of sig.patterns.headers) {
                    for (const [key, value] of Object.entries(headers)) {
                        if (pattern.test(key) || pattern.test(value)) {
                            matches.push(`Header: ${key}`);
                        }
                    }
                }
            }

            if (matches.length > 0) {
                detected.push({
                    name: sig.name,
                    category: sig.category,
                    confidence: matches.length >= 2 ? "high" : "medium",
                    evidence: matches[0],
                });
            }
        }

        // Cleanup
        await page.close();
        await context.close();

        // Build summary
        const summary = buildSummary(detected);

        return {
            success: true,
            technologies: detected,
            summary,
            extractedAt: new Date().toISOString(),
        };
    } catch (error) {
        if (page) await page.close().catch(() => { });
        if (context) await context.close().catch(() => { });

        const message = error instanceof Error ? error.message : "Unknown error";

        if (message.includes("Timeout")) {
            return { success: false, error: "Page load timed out", code: "TIMEOUT" };
        }
        if (message.includes("403") || message.includes("blocked")) {
            return { success: false, error: "Page blocked request", code: "BLOCKED" };
        }

        return { success: false, error: message, code: "UNKNOWN" };
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// SUMMARY BUILDER
// ──────────────────────────────────────────────────────────────────────────────

function buildSummary(technologies: DetectedTech[]): TechStackSummary {
    const frameworks = technologies.filter((t) => t.category === "framework");
    const analytics = technologies.filter((t) => t.category === "analytics");
    const payments = technologies.filter((t) => t.category === "payment");
    const marketing = technologies.filter(
        (t) => t.category === "marketing" || t.category === "chat"
    );
    const hosting = technologies.find((t) => t.category === "hosting");

    return {
        framework: frameworks[0]?.name || null,
        analytics: analytics.map((t) => t.name),
        payments: payments.map((t) => t.name),
        marketing: marketing.map((t) => t.name),
        hosting: hosting?.name || null,
    };
}

// ──────────────────────────────────────────────────────────────────────────────
// TECH STACK COMPARISON
// ──────────────────────────────────────────────────────────────────────────────

export interface TechStackDiff {
    added: DetectedTech[];
    removed: string[];
    summary: string;
}

export function compareTechStacks(
    oldStack: DetectedTech[],
    newStack: DetectedTech[]
): TechStackDiff {
    const oldNames = new Set(oldStack.map((t) => t.name));
    const newNames = new Set(newStack.map((t) => t.name));

    const added = newStack.filter((t) => !oldNames.has(t.name));
    const removed = [...oldNames].filter((name) => !newNames.has(name));

    let summary = "No tech stack changes";
    if (added.length > 0 || removed.length > 0) {
        const parts: string[] = [];
        if (added.length > 0) parts.push(`Added: ${added.map((t) => t.name).join(", ")}`);
        if (removed.length > 0) parts.push(`Removed: ${removed.join(", ")}`);
        summary = parts.join(". ");
    }

    return { added, removed, summary };
}
