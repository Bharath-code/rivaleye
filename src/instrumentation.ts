/**
 * Next.js Instrumentation Hook
 *
 * Runs once when the server starts. Used to initialize Sentry
 * (via dynamic import to keep the cold-start footprint small).
 *
 * In Next.js 15+ this file is auto-detected from `src/instrumentation.ts`.
 */

export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        await import("../sentry.server.config");
    }

    if (process.env.NEXT_RUNTIME === "edge") {
        await import("../sentry.edge.config");
    }
}
