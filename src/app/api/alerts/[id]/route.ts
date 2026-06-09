import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { parseBody, parseQuery, queryAlertIdSchema, updateAlertSchema } from "@/lib/validation/schemas";
import { assertSameOrigin } from "@/lib/csrf";
import { withRequestId, withUser } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

/**
 * Single Alert API
 *
 * GET - Get alert by ID
 * PATCH - Update alert (mark read, dismiss)
 */

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { log, headers: reqHeaders } = withRequestId(request, "GET /api/alerts/[id]");
    try {
        const userId = await getUserId();

        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401, headers: reqHeaders }
            );
        }

        const { id } = await params;
        const supabase = createServerClient();

        const { data: alert, error } = await supabase
            .from("alerts")
            .select(`
                *,
                competitors!inner(
                    id,
                    name,
                    url,
                    user_id
                )
            `)
            .eq("id", id)
            .eq("competitors.user_id", userId)
            .single();

        if (error || !alert) {
            return NextResponse.json(
                { error: "Alert not found" },
                { status: 404, headers: reqHeaders }
            );
        }

        return NextResponse.json(
            { alert },
            { headers: reqHeaders }
        );
    } catch (err) {
        log.error({ err }, "unexpected error in GET /api/alerts/[id]");
        Sentry.captureException(err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500, headers: reqHeaders }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { log, headers: reqHeaders } = withRequestId(request, "PATCH /api/alerts/[id]");
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

        const { id } = await params;

        const parsed = await parseBody(request, updateAlertSchema);
        if (parsed.error) {
            return NextResponse.json(
                await parsed.error.json(),
                { status: 400, headers: reqHeaders }
            );
        }

        const supabase = createServerClient();

        // Verify the alert belongs to user (defense-in-depth: even if a UUID
        // belongs to another user, this query returns 0 rows)
        const { data: alert, error: fetchError } = await supabase
            .from("alerts")
            .select(`
                id,
                competitors!inner(user_id)
            `)
            .eq("id", id)
            .eq("competitors.user_id", userId)
            .single();

        if (fetchError || !alert) {
            return NextResponse.json(
                { error: "Alert not found" },
                { status: 404, headers: reqHeaders }
            );
        }

        const updates: { is_read?: boolean; is_dismissed?: boolean } = {};
        if (parsed.data.is_read !== undefined) updates.is_read = parsed.data.is_read;
        if (parsed.data.is_dismissed !== undefined) updates.is_dismissed = parsed.data.is_dismissed;

        const { error: updateError } = await supabase
            .from("alerts")
            .update(updates)
            .eq("id", id);

        if (updateError) {
            userLog.error({ err: updateError, id }, "failed to update alert");
            Sentry.captureException(updateError);
            return NextResponse.json(
                { error: "Failed to update alert" },
                { status: 500, headers: reqHeaders }
            );
        }

        userLog.info({ id, ...updates }, "alert updated");
        return NextResponse.json(
            { success: true },
            { headers: reqHeaders }
        );
    } catch (err) {
        log.error({ err }, "unexpected error in PATCH /api/alerts/[id]");
        Sentry.captureException(err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500, headers: reqHeaders }
        );
    }
}
