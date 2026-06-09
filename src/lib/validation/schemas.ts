import { z, ZodError, type ZodSchema } from "zod";
import { NextResponse } from "next/server";

/**
 * Centralized Zod Validation
 *
 * One source of truth for every API request body / query / param shape.
 * Use `parseBody(request, Schema)` and `parseQuery(request, Schema)` from
 * API routes — they return either { data } or { error: NextResponse }.
 *
 * Example:
 *   import { parseBody, createCompetitorSchema } from "@/lib/validation/schemas";
 *
 *   export async function POST(request: NextRequest) {
 *       const parsed = await parseBody(request, createCompetitorSchema);
 *       if (parsed.error) return parsed.error;
 *       const { name, url } = parsed.data;
 *       // ...
 *   }
 */

// ══════════════════════════════════════════════════════════════════════════════
// Reusable primitives
// ══════════════════════════════════════════════════════════════════════════════

const uuid = z.string().uuid();
const competitorId = uuid;
const alertId = uuid;
const userId = uuid;

// ══════════════════════════════════════════════════════════════════════════════
// Competitors
// ══════════════════════════════════════════════════════════════════════════════

export const createCompetitorSchema = z.object({
    name: z.string().min(1).max(200),
    url: z.string().url().max(2048),
});
export type CreateCompetitorInput = z.infer<typeof createCompetitorSchema>;

export const updateCompetitorSchema = z
    .object({
        name: z.string().min(1).max(200).optional(),
        url: z.string().url().max(2048).optional(),
    })
    .refine((data) => data.name !== undefined || data.url !== undefined, {
        message: "At least one of name or url must be provided",
    });
export type UpdateCompetitorInput = z.infer<typeof updateCompetitorSchema>;

export const analyzeCompetitorSchema = z.object({
    competitorId,
});
export type AnalyzeCompetitorInput = z.infer<typeof analyzeCompetitorSchema>;

// ══════════════════════════════════════════════════════════════════════════════
// Alerts
// ══════════════════════════════════════════════════════════════════════════════

export const markAlertReadSchema = z.object({
    isRead: z.boolean().optional(),
});

export const slackTestSchema = z.object({
    webhookUrl: z.string().url(),
});

// ══════════════════════════════════════════════════════════════════════════════
// Auth
// ══════════════════════════════════════════════════════════════════════════════

export const authSyncSchema = z.object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
});

// ══════════════════════════════════════════════════════════════════════════════
// Settings
// ══════════════════════════════════════════════════════════════════════════════

export const updateSettingsSchema = z
    .object({
        email_enabled: z.boolean().optional(),
        digest_frequency: z.enum(["instant", "daily", "weekly"]).optional(),
        // Accept empty string → null (we coerce later)
        slack_webhook_url: z
            .union([
                z.literal(""),
                z.string().url().refine(
                    (url) => url.startsWith("https://hooks.slack.com/"),
                    { message: "Must be a Slack webhook URL (https://hooks.slack.com/...)" }
                ),
                z.null(),
            ])
            .optional(),
    })
    .refine(
        (data) =>
            data.email_enabled !== undefined ||
            data.digest_frequency !== undefined ||
            data.slack_webhook_url !== undefined,
        { message: "At least one field must be provided" }
    );
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

// ══════════════════════════════════════════════════════════════════════════════
// Schedule
// ══════════════════════════════════════════════════════════════════════════════

export const createScheduleSchema = z.object({
    plan: z.enum(["free", "pro", "enterprise"]).default("free"),
    timezone: z.string().min(1).max(100).default("UTC"),
});
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;

// ══════════════════════════════════════════════════════════════════════════════
// Alerts
// ══════════════════════════════════════════════════════════════════════════════

export const updateAlertSchema = z
    .object({
        is_read: z.boolean().optional(),
        is_dismissed: z.boolean().optional(),
    })
    .refine(
        (data) => data.is_read !== undefined || data.is_dismissed !== undefined,
        { message: "At least one of is_read or is_dismissed must be provided" }
    );
export type UpdateAlertInput = z.infer<typeof updateAlertSchema>;

export const slackAlertSchema = z.union([
    // Real send mode
    z.object({ alertId: z.string().uuid() }),
    // Test mode
    z.object({
        test: z.literal(true),
        webhookUrl: z.string().url().refine(
            (url) => url.startsWith("https://hooks.slack.com/"),
            { message: "Must be a Slack webhook URL" }
        ),
    }),
]);
export type SlackAlertInput = z.infer<typeof slackAlertSchema>;

// ══════════════════════════════════════════════════════════════════════════════
// Market Radar
// ══════════════════════════════════════════════════════════════════════════════

export const marketRadarSchema = z.object({}).optional();

// ══════════════════════════════════════════════════════════════════════════════
// CSRF
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Whitelist of origins allowed to make POST/PATCH/DELETE requests.
 *
 * Configured via NEXT_PUBLIC_APP_URL in env. In dev, allows localhost.
 *
 * Used by `assertSameOrigin()` in API routes to prevent CSRF:
 *  curl -X POST /api/competitors -H "Origin: https://evil.com" → 403
 */
export function getAllowedOrigins(): string[] {
    const origins: string[] = [];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) origins.push(appUrl);
    if (process.env.NODE_ENV !== "production") {
        origins.push("http://localhost:3000");
        origins.push("http://127.0.0.1:3000");
    }
    return origins;
}

// ══════════════════════════════════════════════════════════════════════════════
// Parsing helpers
// ══════════════════════════════════════════════════════════════════════════════

type ParseResult<T> =
    | { data: T; error: null }
    | { data: null; error: NextResponse };

/**
 * Parse a JSON request body against a Zod schema.
 * Returns a typed result; on failure, returns a 400 NextResponse with
 * field-level error details.
 */
export async function parseBody<T>(
    request: Request,
    schema: ZodSchema<T>
): Promise<ParseResult<T>> {
    try {
        const raw = await request.json();
        const data = schema.parse(raw);
        return { data, error: null };
    } catch (err) {
        if (err instanceof ZodError) {
            return {
                data: null,
                error: NextResponse.json(
                    {
                        error: "Validation failed",
                        issues: err.issues.map((i) => ({
                            path: i.path.join("."),
                            message: i.message,
                            code: i.code,
                        })),
                    },
                    { status: 400 }
                ),
            };
        }
        // Body wasn't valid JSON
        return {
            data: null,
            error: NextResponse.json(
                { error: "Invalid JSON body" },
                { status: 400 }
            ),
        };
    }
}

/**
 * Parse URL query params against a Zod schema.
 * Useful for DELETE /resource?id=xxx routes.
 */
export function parseQuery<T>(
    request: Request,
    schema: ZodSchema<T>
): ParseResult<T> {
    try {
        const { searchParams } = new URL(request.url);
        const obj: Record<string, string> = {};
        searchParams.forEach((v, k) => { obj[k] = v; });
        const data = schema.parse(obj);
        return { data, error: null };
    } catch (err) {
        if (err instanceof ZodError) {
            return {
                data: null,
                error: NextResponse.json(
                    {
                        error: "Invalid query parameters",
                        issues: err.issues.map((i) => ({
                            path: i.path.join("."),
                            message: i.message,
                        })),
                    },
                    { status: 400 }
                ),
            };
        }
        return {
            data: null,
            error: NextResponse.json(
                { error: "Invalid query" },
                { status: 400 }
            ),
        };
    }
}

export const queryIdSchema = z.object({ id: z.string().uuid() });
export const queryCompetitorIdSchema = z.object({ id: z.string().uuid() });
export const queryAlertIdSchema = z.object({ id: z.string().uuid() });
