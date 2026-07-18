import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { parseQuery } from "@/lib/validation/schemas";
import { topCitedDomains } from "@/lib/aeo/citations";
import { withRequestId, withUser } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

/**
 * GET /api/aeo/citations?competitorId=<uuid>&windowDays=30
 *
 * PAR-2: ranked domains that answer engines cite when discussing this
 * competitor's space — tells the user WHERE to earn mentions.
 */
const querySchema = z.object({
    competitorId: z.string().uuid(),
    windowDays: z.coerce.number().int().min(1).max(90).default(30),
});

export async function GET(request: NextRequest) {
    const { log, headers: reqHeaders } = withRequestId(request, "GET /api/aeo/citations");
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
        const { competitorId, windowDays } = parsed.data;
        const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

        const supabase = createServerClient();
        const { data: rows, error } = await supabase
            .from("aeo_visibility")
            .select("citations")
            .eq("user_id", userId)
            .eq("competitor_id", competitorId)
            .gte("scanned_at", since);

        if (error) {
            userLog.error({ err: error }, "AEO citations query failed");
            throw error;
        }

        return NextResponse.json(
            { window_days: windowDays, domains: topCitedDomains(rows ?? []) },
            { headers: reqHeaders }
        );
    } catch (err) {
        log.error({ err }, "AEO citations failed");
        Sentry.captureException(err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500, headers: reqHeaders }
        );
    }
}
