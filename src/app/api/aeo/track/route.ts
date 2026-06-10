import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { runAEOScan } from "@/lib/aeo/scan";
import { parseBody } from "@/lib/validation/schemas";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/csrf";
import { withRequestId, withUser } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

/**
 * POST /api/aeo/track
 *
 * Trigger an AEO scan for a single competitor.
 *
 * Body:
 *   { competitorId: string, queries?: string[], models?: ModelName[] }
 *
 * Returns a ScanResult summary on completion.
 *
 * Cost: 5-50 cents per scan depending on #queries × #models.
 * For Pro users (manual trigger), 5-10 queries × 5 models is the default.
 */

const ModelNameSchema = z.enum([
    "chatgpt",
    "perplexity",
    "claude",
    "gemini",
    "google_ai",
]);

const trackSchema = z.object({
    competitorId: z.string().uuid(),
    queries: z.array(z.string().min(5).max(200)).max(15).optional(),
    models: z.array(ModelNameSchema).min(1).max(5).optional(),
});

export async function POST(request: NextRequest) {
    const { log, headers: reqHeaders } = withRequestId(
        request,
        "POST /api/aeo/track"
    );
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

        const parsed = await parseBody(request, trackSchema);
        if (parsed.error) {
            return NextResponse.json(
                await parsed.error.json(),
                { status: 400, headers: reqHeaders }
            );
        }
        const { competitorId, queries, models } = parsed.data;

        userLog.info(
            { competitorId, queries: queries?.length, models: models?.length },
            "AEO scan triggered"
        );

        const result = await runAEOScan(userId, competitorId, {
            queries,
            models,
        });

        return NextResponse.json(result, { headers: reqHeaders });
    } catch (err) {
        log.error({ err }, "AEO scan failed");
        Sentry.captureException(err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "AEO scan failed" },
            { status: 500, headers: reqHeaders }
        );
    }
}
