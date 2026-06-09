import * as Sentry from "@sentry/nextjs";

/**
 * Sentry Server-Side Configuration
 *
 * Loaded on every server-side request. DSN is read from SENTRY_DSN env.
 * If unset, Sentry is effectively a no-op (safe for local dev).
 */

const dsn = process.env.SENTRY_DSN;

if (dsn) {
    Sentry.init({
        dsn,
        environment: process.env.NODE_ENV,
        release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

        // Sample rate: 100% in dev, 10% in prod
        tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

        // Don't send PII by default
        sendDefaultPii: false,

        // Scrub sensitive data from event breadcrumbs
        beforeBreadcrumb(breadcrumb) {
            if (breadcrumb.category === "http") {
                // Strip auth headers from request breadcrumbs
                if (breadcrumb.data?.headers) {
                    delete breadcrumb.data.headers["authorization"];
                    delete breadcrumb.data.headers["cookie"];
                }
            }
            return breadcrumb;
        },
    });
}
