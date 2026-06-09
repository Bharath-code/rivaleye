import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { withRequestId, withUser } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

/**
 * Mark All Alerts Read API
 *
 * POST - Mark all user's alerts as read
 */

export async function POST(request: NextRequest) {
    const { log, headers: reqHeaders } = withRequestId(request, "POST /api/alerts/mark-all-read");
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

        const { data: competitors, error: compError } = await supabase
            .from("competitors")
            .select("id")
            .eq("user_id", userId);

        if (compError) {
            userLog.error({ err: compError }, "failed to fetch competitor ids");
            Sentry.captureException(compError);
            return NextResponse.json(
                { error: "Failed to fetch data" },
                { status: 500, headers: reqHeaders }
            );
        }

        if (!competitors?.length) {
            return NextResponse.json(
                { marked: 0 },
                { headers: reqHeaders }
            );
        }

        const competitorIds = competitors.map((c) => c.id);

        const { error: updateError, count } = await supabase
            .from("alerts")
            .update({ is_read: true })
            .in("competitor_id", competitorIds)
            .eq("is_read", false);

        if (updateError) {
            userLog.error({ err: updateError }, "failed to mark alerts read");
            Sentry.captureException(updateError);
            return NextResponse.json(
                { error: "Failed to mark alerts" },
                { status: 500, headers: reqHeaders }
            );
        }

        userLog.info({ marked: count || 0 }, "all alerts marked read");
        return NextResponse.json(
            { success: true, marked: count || 0 },
            { headers: reqHeaders }
        );
    } catch (err) {
        log.error({ err }, "unexpected error in POST /api/alerts/mark-all-read");
        Sentry.captureException(err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500, headers: reqHeaders }
        );
    }
}
