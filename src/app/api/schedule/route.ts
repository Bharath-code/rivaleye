import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { parseBody, createScheduleSchema } from "@/lib/validation/schemas";
import { assertSameOrigin } from "@/lib/csrf";
import { withRequestId, withUser } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

/**
 * POST /api/schedule
 *
 * Create or update a user's analysis schedule based on their plan.
 */
export async function POST(request: NextRequest) {
    const { log, headers: reqHeaders } = withRequestId(request, "POST /api/schedule");
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

        const parsed = await parseBody(request, createScheduleSchema);
        if (parsed.error) {
            return NextResponse.json(
                await parsed.error.json(),
                { status: 400, headers: reqHeaders }
            );
        }
        const { plan, timezone } = parsed.data;

        const { createUserSchedule } = await import("@/trigger/userSchedules");
        const result = await createUserSchedule(userId, plan, timezone);

        const supabase = createServerClient();
        const { error } = await supabase
            .from("users")
            .update({
                schedule_id: result.scheduleId,
                plan_type: plan,
            })
            .eq("id", userId);

        if (error) {
            userLog.error({ err: error }, "failed to store schedule_id");
            Sentry.captureException(error);
        }

        userLog.info({ plan, timezone, scheduleId: result.scheduleId }, "schedule created");
        return NextResponse.json(
            {
                success: true,
                scheduleId: result.scheduleId,
                cron: result.cron,
                plan,
                timezone,
            },
            { headers: reqHeaders }
        );
    } catch (err) {
        log.error({ err }, "unexpected error in POST /api/schedule");
        Sentry.captureException(err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to create schedule" },
            { status: 500, headers: reqHeaders }
        );
    }
}

/**
 * DELETE /api/schedule
 *
 * Deactivate a user's schedule (e.g., on subscription cancel)
 */
export async function DELETE(request: NextRequest) {
    const { log, headers: reqHeaders } = withRequestId(request, "DELETE /api/schedule");
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

        const supabase = createServerClient();
        const { data: user } = await supabase
            .from("users")
            .select("schedule_id")
            .eq("id", userId)
            .single();

        if (!user?.schedule_id) {
            return NextResponse.json(
                { error: "No schedule found" },
                { status: 404, headers: reqHeaders }
            );
        }

        const { deactivateUserSchedule } = await import("@/trigger/userSchedules");
        await deactivateUserSchedule(user.schedule_id);

        userLog.info({ scheduleId: user.schedule_id }, "schedule deactivated");
        return NextResponse.json({ success: true }, { headers: reqHeaders });
    } catch (err) {
        log.error({ err }, "unexpected error in DELETE /api/schedule");
        Sentry.captureException(err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to deactivate schedule" },
            { status: 500, headers: reqHeaders }
        );
    }
}

/**
 * GET /api/schedule
 *
 * Get current user's schedule info
 */
export async function GET(request: NextRequest) {
    const { log, headers: reqHeaders } = withRequestId(request, "GET /api/schedule");
    try {
        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401, headers: reqHeaders }
            );
        }

        const supabase = createServerClient();
        const { data: user } = await supabase
            .from("users")
            .select("schedule_id, plan_type")
            .eq("id", userId)
            .single();

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404, headers: reqHeaders }
            );
        }

        const cronDescriptions: Record<string, string> = {
            free: "Daily at 6 AM UTC",
            pro: "Every 6 hours",
            enterprise: "Every hour",
        };

        return NextResponse.json(
            {
                scheduleId: user.schedule_id,
                plan: user.plan_type || "free",
                frequency: cronDescriptions[user.plan_type || "free"],
            },
            { headers: reqHeaders }
        );
    } catch (err) {
        log.error({ err }, "unexpected error in GET /api/schedule");
        Sentry.captureException(err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to get schedule" },
            { status: 500, headers: reqHeaders }
        );
    }
}
