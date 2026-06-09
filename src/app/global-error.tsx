"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

/**
 * Global Error Boundary
 *
 * Captures all unhandled React render errors and reports to Sentry.
 * Renders Next.js default error UI as fallback.
 */

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html>
            <body>
                <NextError statusCode={500} />
            </body>
        </html>
    );
}
