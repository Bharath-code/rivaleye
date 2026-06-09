import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { withRequestId, withUser } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

/**
 * Alerts API
 *
 * GET - List user's alerts
 */

export async function GET(request: NextRequest) {
    const { log, headers: reqHeaders } = withRequestId(request, "GET /api/alerts");
    try {
        const userId = await getUserId();

        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401, headers: reqHeaders }
            );
        }

        const supabase = createServerClient();

        const { data: alerts, error } = await supabase
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
            .eq("competitors.user_id", userId)
            .order("created_at", { ascending: false })
            .limit(20);

        if (error) {
            withUser(log, userId).error({ err: error }, "failed to fetch alerts");
            Sentry.captureException(error);
            return NextResponse.json(
                { error: "Failed to fetch alerts" },
                { status: 500, headers: reqHeaders }
            );
        }

        return NextResponse.json(
            { alerts },
            { headers: reqHeaders }
        );
    } catch (err) {
        log.error({ err }, "unexpected error in GET /api/alerts");
        Sentry.captureException(err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500, headers: reqHeaders }
        );
    }
}
