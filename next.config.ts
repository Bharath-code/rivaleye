import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Next.js config
 *
 * Wrapped with Sentry for automatic error capture and source-map upload.
 * - DSN: read from SENTRY_DSN env (no-op if unset — Sentry is opt-in)
 * - Tunnel route: /monitoring tunnels events to avoid ad-blocker blocking
 * - Source maps: uploaded at build time
 * - Sample rate: 100% in dev, 10% in prod (set in sentry.server.config.ts)
 */

const nextConfig: NextConfig = {
    async headers() {
        return [
            {
                source: "/:path*",
                headers: [
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                ],
            },
        ];
    },
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
