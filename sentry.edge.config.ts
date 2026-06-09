import * as Sentry from "@sentry/nextjs";

/**
 * Sentry Edge Runtime Configuration
 *
 * Loaded for edge middleware/proxy and edge API routes.
 * DSN read from SENTRY_DSN env. Safe to leave unset.
 */

const dsn = process.env.SENTRY_DSN;

if (dsn) {
    Sentry.init({
        dsn,
        environment: process.env.NODE_ENV,
        release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

        tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
        sendDefaultPii: false,
    });
}
