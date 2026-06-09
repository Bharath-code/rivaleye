import pino, { type Logger } from "pino";
import { randomUUID } from "crypto";

/**
 * Structured Logger (pino)
 *
 * - JSON output in production (for log aggregators like Vercel/Datadog)
 * - Pretty output in development (for humans)
 * - Every log line includes: requestId, userId (if known), route, method
 * - Sensitive headers (authorization, cookie) are auto-redacted
 *
 * Usage in API routes:
 *
 *   import { logger, withRequestId } from "@/lib/logger";
 *
 *   export async function POST(request: NextRequest) {
 *       const { log, headers } = withRequestId(request, "POST /api/competitors");
 *       try {
 *           log.info({ competitorId }, "creating competitor");
 *           return NextResponse.json({ ok: true }, { headers });
 *       } catch (err) {
 *           log.error({ err }, "create failed");
 *           return NextResponse.json({ error: "..." }, { status: 500, headers });
 *       }
 *   }
 *
 * In trigger.dev tasks, prefer the built-in `logger` from @trigger.dev/sdk
 * (it already includes runId / taskId). Use this only for cross-runtime
 * shared code (crawler, diff engine, alert generators).
 */

const isProd = process.env.NODE_ENV === "production";

export const logger: Logger = pino({
    level: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),

    // Pretty in dev, JSON in prod
    transport: isProd
        ? undefined
        : {
            target: "pino-pretty",
            options: {
                colorize: true,
                translateTime: "HH:MM:ss.l",
                ignore: "pid,hostname",
            },
        },

    // Base context attached to every log line
    base: {
        service: "rivaleye",
        env: process.env.NODE_ENV,
        version: process.env.NEXT_PUBLIC_SENTRY_RELEASE || "dev",
    },

    // Redact sensitive data — never log auth headers / cookies / passwords
    redact: {
        paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "headers.authorization",
            "headers.cookie",
            "*.password",
            "*.token",
            "*.accessToken",
            "*.refreshToken",
        ],
        censor: "[REDACTED]",
    },

    // ISO timestamps (Vercel log aggregator expects this)
    timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Wrap a request with a requestId-bound child logger.
 * Returns the logger and a `headers` object that the caller should
 * attach to its response so the client sees the same X-Request-Id
 * (useful for support tickets: "what was the request ID?").
 */
export function withRequestId(
    request: Request,
    route: string
): { log: Logger; requestId: string; headers: Record<string, string> } {
    // Honor an upstream X-Request-Id if one was sent (e.g. from a Vercel edge proxy)
    const incoming =
        request.headers.get("x-request-id") ||
        request.headers.get("x-vercel-id") ||
        request.headers.get("x-amzn-trace-id");

    const requestId = incoming || randomUUID();

    const log = logger.child({
        requestId,
        route,
        method: request.method,
        url: request.url,
    });

    return {
        log,
        requestId,
        headers: {
            "X-Request-Id": requestId,
        },
    };
}

/**
 * Add a userId to an existing child logger (call after auth resolves).
 * This keeps the auth layer decoupled from the logger.
 */
export function withUser(log: Logger, userId: string): Logger {
    return log.child({ userId });
}
