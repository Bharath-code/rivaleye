import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getVisibilitySummary } from "@/lib/aeo/scan";
import { aggregateVisibility } from "@/lib/aeo/aggregateVisibility";
import { createServerClient } from "@/lib/supabase";
import { parseQuery } from "@/lib/validation/schemas";
import { z } from "zod";
import { withRequestId, withUser } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

/**
 * GET /api/aeo/summary?windowDays=7
 *
 * Dashboard-level AEO visibility blended across all of the user's
 * AEO-enabled competitors. Powers the "AI Visibility" panel so the
 * wedge feature is discoverable without drilling into each competitor.
 */

const querySchema = z.object({
    windowDays: z.coerce.number().int().min(1).max(90).default(7),
});

export async function GET(request: NextRequest) {
    const { log, headers: reqHeaders } = withRequestId(
        request,
        "GET /api/aeo/summary"
    );
    try {
        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401, headers: reqHeaders }
            );
        }
        const userLog = withUser(log, userId);

        const parsed = parseQuery(request, querySchema);
        if (parsed.error) {
            return NextResponse.json(
                await parsed.error.json(),
                { status: 400, headers: reqHeaders }
            );
        }
        const { windowDays } = parsed.data;

        const supabase = createServerClient();
        const { data: competitors, error } = await supabase
            .from("competitors")
            .select("id, name, aeo_enabled")
            .eq("user_id", userId)
            .eq("aeo_enabled", true);

        if (error) {
            userLog.error({ err: error }, "AEO summary competitor fetch failed");
            throw error;
        }

        const tracked = competitors || [];
        const summaries = await Promise.all(
            tracked.map(async (c) => ({
                id: c.id,
                name: c.name,
                summary: await getVisibilitySummary(userId, c.id, windowDays),
            }))
        );

        return NextResponse.json(
            {
                window_days: windowDays,
                ...aggregateVisibility(summaries),
            },
            { headers: reqHeaders }
        );
    } catch (err) {
        log.error({ err }, "AEO summary failed");
        Sentry.captureException(err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500, headers: reqHeaders }
        );
    }
}
