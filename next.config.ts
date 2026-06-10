import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Next.js config
 *
 * Wrapped with Sentry for automatic error capture and source-map upload.
 *
 * Security headers (set globally on every response):
 *  - Content-Security-Policy: strict default-src 'self', whitelists
 *    Sentry, PostHog, Resend, Cloudflare, Dodo, Google Fonts
 *  - X-Content-Type-Options: nosniff
 *  - X-Frame-Options: DENY (anti-clickjacking)
 *  - Referrer-Policy: strict-origin-when-cross-origin
 *  - Permissions-Policy: camera/mic/geolocation off (not used by app)
 *  - Strict-Transport-Security: HSTS enabled in prod (1-year, includeSubDomains)
 */

const securityHeaders = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
    // CSP: strict default-src 'self' with explicit allowlists for known third-parties
    {
        key: "Content-Security-Policy",
        value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io https://*.cloudflareinsights.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src 'self' data: blob: https:",
            "connect-src 'self' https://*.supabase.co https://*.sentry.io https://us.i.posthog.com https://eu.i.posthog.com https://static.cloudflareinsights.com",
            "frame-ancestors 'none'",
            "form-action 'self'",
            "base-uri 'self'",
            "object-src 'none'",
        ].join("; "),
    },
    // HSTS: only meaningful over HTTPS, so only set in prod
    ...(process.env.NODE_ENV === "production"
        ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }]
        : []),
];

const nextConfig: NextConfig = {
    async headers() {
        return [
            {
                source: "/:path*",
                headers: securityHeaders,
            },
        ];
    },
    // Native Node.js packages that should NOT be bundled by Turbopack.
    // Bundling pino/thread-stream causes Turbopack to walk into their
    // test fixtures and fail. Marking them serverExternal keeps them
    // required at runtime in the node_modules tree.
    serverExternalPackages: [
        "pino",
        "thread-stream",
        "playwright",
        "@sparticuz/chromium",
    ],
};

export default withSentryConfig(nextConfig, {
    // Tunnel route to bypass ad-blockers
    tunnelRoute: "/monitoring",

    // Source map upload (only fires in production builds)
    sourcemaps: {
        disable: false,
    },

    // Don't fail builds on missing/invalid Sentry config
    silent: !process.env.CI,

    // Source map upload org/project (only used in prod builds)
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,

    // Auth token (only used for upload — never sent to client)
    authToken: process.env.SENTRY_AUTH_TOKEN,
});
