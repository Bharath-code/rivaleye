import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { analyzeCompetitorTask } from "@/trigger/analyzeCompetitor";
import { checkRateLimit, RATE_LIMITS, rateLimitHeaders } from "@/lib/rateLimit";
import { validateCompetitorUrl } from "@/lib/urlValidator";
import { getFeatureFlags } from "@/lib/billing/featureFlags";
import { withRequestId, withUser } from "@/lib/logger";
import { parseBody, parseQuery, createCompetitorSchema, queryIdSchema } from "@/lib/validation/schemas";
import { assertSameOrigin } from "@/lib/csrf";
import * as Sentry from "@sentry/nextjs";

/**
 * Competitors API
 *
 * GET - List user's competitors
 * POST - Add new competitor (triggers first crawl)
 * DELETE - Remove competitor
 *
 * All handlers use structured logging (pino) with request-id correlation
 * and capture exceptions to Sentry on the 5xx path.
 */

/**
 * Ensures user exists in our users table (auto-creates if missing)
 */
async function ensureUserExists(userId: string): Promise<void> {
    const supabase = createServerClient();

    const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("id", userId)
        .single();

    if (!existingUser) {
        const { data: authData } = await supabase.auth.admin.getUserById(userId);
        const email = authData?.user?.email || `user-${userId}@temp.local`;

        await supabase.from("users").insert({
            id: userId,
            email: email,
            plan: "free",
            subscription_status: "none",
            crawls_today: 0,
            manual_checks_today: 0,
            last_quota_reset: new Date().toISOString(),
        });

        console.log(`Created user record for ${userId} with email: ${email}`);
    }
}

// GET /api/competitors
export async function GET(request: NextRequest) {
    const { log, headers: reqHeaders } = withRequestId(request, "GET /api/competitors");
    try {
        const userId = await getUserId();
        if (!userId) {
            log.warn("unauthorized GET /api/competitors");
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401, headers: reqHeaders }
            );
        }

        const userLog = withUser(log, userId);
        await ensureUserExists(userId);

        const supabase = createServerClient();
        const { data: competitors, error } = await supabase
            .from("competitors")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) {
            userLog.error({ err: error }, "failed to fetch competitors");
            Sentry.captureException(error);
            return NextResponse.json(
                { error: "Failed to fetch competitors" },
                { status: 500, headers: reqHeaders }
            );
        }

        const { data: user } = await supabase
            .from("users")
            .select("plan")
            .eq("id", userId)
            .single();

        userLog.debug({ count: competitors?.length ?? 0 }, "fetched competitors");

        return NextResponse.json(
            { competitors, plan: user?.plan || "free" },
            { headers: reqHeaders }
        );
    } catch (err) {
        log.error({ err }, "unexpected error in GET /api/competitors");
        Sentry.captureException(err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500, headers: reqHeaders }
        );
    }
}

// POST /api/competitors
export async function POST(request: NextRequest) {
    const { log, headers: reqHeaders } = withRequestId(request, "POST /api/competitors");
    try {
        const csrf = assertSameOrigin(request);
        if (csrf) return csrf;

        const userId = await getUserId();
        if (!userId) {
            log.warn("unauthorized POST /api/competitors");
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401, headers: reqHeaders }
            );
        }
        const userLog = withUser(log, userId);

        // Rate limit
        const rateCheck = await checkRateLimit(`competitors:${userId}`, RATE_LIMITS.competitors);
        if (!rateCheck.allowed) {
            userLog.warn({ rateCheck }, "rate limit hit on POST /api/competitors");
            return NextResponse.json(
                { error: "Too many requests. Please slow down." },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(Math.ceil(rateCheck.resetMs / 1000)),
                        ...rateLimitHeaders(rateCheck, RATE_LIMITS.competitors),
                        ...reqHeaders,
                    },
                }
            );
        }

        await ensureUserExists(userId);

        const parsed = await parseBody(request, createCompetitorSchema);
        if (parsed.error) {
            return NextResponse.json(
                await parsed.error.json(),
                { status: 400, headers: reqHeaders }
            );
        }
        const { name, url } = parsed.data;

        // Validate URL (SSRF protection)
        const urlValidation = validateCompetitorUrl(url);
        if (!urlValidation.valid) {
            userLog.warn({ url, error: urlValidation.error }, "url validation failed");
            return NextResponse.json(
                { error: urlValidation.error },
                { status: 400, headers: reqHeaders }
            );
        }
        const safeUrl = urlValidation.sanitizedUrl!;

        const supabase = createServerClient();

        const { data: user } = await supabase
            .from("users")
            .select("plan")
            .eq("id", userId)
            .single();

        const { count: existingCount } = await supabase
            .from("competitors")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId);

        const userPlan = (user?.plan || "free") as "free" | "pro" | "enterprise";
        const flags = getFeatureFlags(userPlan);

        if ((existingCount ?? 0) >= flags.maxCompetitors) {
            userLog.info({ userPlan, existingCount, max: flags.maxCompetitors }, "competitor limit hit");
            return NextResponse.json(
                { error: `Free plan limited to ${flags.maxCompetitors} competitor. Upgrade to Pro for more.` },
                { status: 403, headers: reqHeaders }
            );
        }

        const { data: competitor, error } = await supabase
            .from("competitors")
            .insert({
                user_id: userId,
                name,
                url: safeUrl,
                status: "active",
                failure_count: 0,
            })
            .select()
            .single();

        if (error) {
            userLog.error({ err: error }, "failed to insert competitor");
            Sentry.captureException(error);
            return NextResponse.json(
                { error: "Failed to create competitor" },
                { status: 500, headers: reqHeaders }
            );
        }

        userLog.info({ competitorId: competitor.id, name }, "competitor created");

        // Trigger first crawl asynchronously (fire-and-forget)
        try {
            await analyzeCompetitorTask.trigger({
                competitorId: competitor.id,
                competitorUrl: competitor.url,
                competitorName: competitor.name,
                userId,
            });
            userLog.info({ competitorId: competitor.id }, "first analysis triggered");
        } catch (triggerError) {
            userLog.error({ err: triggerError, competitorId: competitor.id }, "failed to trigger first analysis");
            Sentry.captureException(triggerError);
            // Non-blocking: log but don't fail the request
        }

        return NextResponse.json(
            { competitor },
            { status: 201, headers: reqHeaders }
        );
    } catch (err) {
        log.error({ err }, "unexpected error in POST /api/competitors");
        Sentry.captureException(err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500, headers: reqHeaders }
        );
    }
}

// DELETE /api/competitors?id=xxx
export async function DELETE(request: NextRequest) {
    const { log, headers: reqHeaders } = withRequestId(request, "DELETE /api/competitors");
    try {
        const csrf = assertSameOrigin(request);
        if (csrf) return csrf;

        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401, headers: reqHeaders }
            );
        }
        const userLog = withUser(log, userId);

        const parsed = parseQuery(request, queryIdSchema);
        if (parsed.error) {
            return NextResponse.json(
                await parsed.error.json(),
                { status: 400, headers: reqHeaders }
            );
        }
        const { id } = parsed.data;

        const supabase = createServerClient();

        const { data: competitor } = await supabase
            .from("competitors")
            .select("user_id")
            .eq("id", id)
            .single();

        if (!competitor || competitor.user_id !== userId) {
            userLog.warn({ id }, "delete attempt on non-owned competitor");
            return NextResponse.json(
                { error: "Not found" },
                { status: 404, headers: reqHeaders }
            );
        }

        const { error } = await supabase
            .from("competitors")
            .delete()
            .eq("id", id);

        if (error) {
            userLog.error({ err: error, id }, "failed to delete competitor");
            Sentry.captureException(error);
            return NextResponse.json(
                { error: "Failed to delete competitor" },
                { status: 500, headers: reqHeaders }
            );
        }

        userLog.info({ id }, "competitor deleted");
        return NextResponse.json({ success: true }, { headers: reqHeaders });
    } catch (err) {
        log.error({ err }, "unexpected error in DELETE /api/competitors");
        Sentry.captureException(err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500, headers: reqHeaders }
        );
    }
}
