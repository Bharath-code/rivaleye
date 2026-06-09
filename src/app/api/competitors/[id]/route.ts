import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { parseBody, updateCompetitorSchema } from "@/lib/validation/schemas";
import { assertSameOrigin } from "@/lib/csrf";
import { withRequestId, withUser } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

/**
 * Competitor Update API
 *
 * PATCH /api/competitors/[id] - Update competitor name/URL
 *
 * If URL changes, all historical data (snapshots, alerts) is reset
 * to maintain data integrity and prevent misuse.
 */

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const { log, headers: reqHeaders } = withRequestId(request, "PATCH /api/competitors/[id]");
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

        const parsed = await parseBody(request, updateCompetitorSchema);
        if (parsed.error) {
            return NextResponse.json(
                await parsed.error.json(),
                { status: 400, headers: reqHeaders }
            );
        }
        const { name, url } = parsed.data;

        const supabase = createServerClient();

        // Fetch current competitor and verify ownership
        const { data: competitor, error: fetchError } = await supabase
            .from("competitors")
            .select("*")
            .eq("id", id)
            .single();

        if (fetchError || !competitor) {
            return NextResponse.json(
                { error: "Competitor not found" },
                { status: 404, headers: reqHeaders }
            );
        }

        if (competitor.user_id !== userId) {
            userLog.warn({ id }, "attempted to edit competitor owned by another user");
            return NextResponse.json(
                { error: "Forbidden" },
                { status: 403, headers: reqHeaders }
            );
        }

        const urlIsChanging = url && url !== competitor.url;
        let historyReset = false;

        if (urlIsChanging) {
            // Non-fatal cleanup: log errors but don't fail the request
            const { error: snapshotDeleteError } = await supabase
                .from("snapshots")
                .delete()
                .eq("competitor_id", id);
            if (snapshotDeleteError) {
                userLog.error({ err: snapshotDeleteError }, "snapshot cleanup failed");
            }

            const { error: alertDeleteError } = await supabase
                .from("alerts")
                .delete()
                .eq("competitor_id", id);
            if (alertDeleteError) {
                userLog.error({ err: alertDeleteError }, "alert cleanup failed");
            }

            historyReset = true;
            userLog.info({ id, name: competitor.name }, "URL changed, history reset");
        }

        const updatePayload: Record<string, unknown> = {};
        if (name) updatePayload.name = name;
        if (url) updatePayload.url = url;
        if (urlIsChanging) {
            updatePayload.last_checked_at = null;
            updatePayload.failure_count = 0;
            updatePayload.status = "active";
        }

        const { data: updatedCompetitor, error: updateError } = await supabase
            .from("competitors")
            .update(updatePayload)
            .eq("id", id)
            .select()
            .single();

        if (updateError) {
            userLog.error({ err: updateError }, "failed to update competitor");
            Sentry.captureException(updateError);
            return NextResponse.json(
                { error: "Failed to update competitor" },
                { status: 500, headers: reqHeaders }
            );
        }

        userLog.info({ id, fields: Object.keys(updatePayload) }, "competitor updated");
        return NextResponse.json(
            {
                competitor: updatedCompetitor,
                historyReset,
                message: historyReset
                    ? "Competitor updated. Historical data has been reset due to URL change."
                    : "Competitor updated successfully.",
            },
            { headers: reqHeaders }
        );
    } catch (err) {
        log.error({ err }, "unexpected error in PATCH /api/competitors/[id]");
        Sentry.captureException(err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500, headers: reqHeaders }
        );
    }
}
