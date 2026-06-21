import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { pushToSlack } from "@/lib/alerts/slackIntegration";
import { parseBody, slackAlertSchema } from "@/lib/validation/schemas";
import { assertSameOrigin } from "@/lib/csrf";
import { withRequestId, withUser } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

/**
 * Send Alert to Slack API
 *
 * POST /api/alerts/slack
 * Two modes:
 *  - { alertId } - send an existing alert
 *  - { test: true, webhookUrl } - test the user's Slack webhook
 */
export async function POST(request: NextRequest) {
    const { log, headers: reqHeaders } = withRequestId(request, "POST /api/alerts/slack");
    try {
        const csrf = assertSameOrigin(request);
        if (csrf) return csrf;

        const parsed = await parseBody(request, slackAlertSchema);
        if (parsed.error) {
            return NextResponse.json(
                await parsed.error.json(),
                { status: 400, headers: reqHeaders }
            );
        }

        // Test mode
        if ("test" in parsed.data) {
            const result = await pushToSlack({
                title: "🧪 Test Alert from RivalEye",
                description:
                    "Your Slack integration is working perfectly! You'll receive alerts here when competitors make pricing changes.",
                competitorName: "Test Competitor",
                webhookUrl: parsed.data.webhookUrl,
            });
            return NextResponse.json(result, { headers: reqHeaders });
        }

        // Real send mode
        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401, headers: reqHeaders }
            );
        }
        const userLog = withUser(log, userId);
        const alertId = parsed.data.alertId;

        const supabase = createServerClient();

        const { data: alert, error: alertError } = await supabase
            .from("alerts")
            .select("*, competitors(name, url, user_id)")
            .eq("id", alertId)
            .eq("competitors.user_id", userId)
            .single();

        if (alertError || !alert) {
            userLog.warn({ alertId }, "alert not found");
            return NextResponse.json(
                { error: "Alert not found" },
                { status: 404, headers: reqHeaders }
            );
        }

        const { data: userData } = await supabase
            .from("users")
            .select("plan")
            .eq("id", userId)
            .single();
        if (userData?.plan !== "pro" && userData?.plan !== "enterprise") {
            return NextResponse.json(
                { error: "Pro plan required for Slack integration" },
                { status: 403, headers: reqHeaders }
            );
        }

        const details = alert.details || {};
        const insight =
            typeof alert.ai_insight === "string"
                ? JSON.parse(alert.ai_insight)
                : alert.ai_insight;

        const result = await pushToSlack({
            title: alert.title,
            description: alert.description,
            competitorName: alert.competitors.name,
            link: `${process.env.NEXT_PUBLIC_APP_URL || "https://rivaleye.app"}/dashboard/alerts/${alert.id}`,
            playbook: {
                salesDraft:
                    details.tacticalPlaybook?.salesDraft ||
                    insight?.tacticalPlaybook?.salesDraft,
            },
        });

        if (!result.success) {
            userLog.error({ err: result.error }, "slack send failed");
            return NextResponse.json(
                { error: result.error },
                { status: 500, headers: reqHeaders }
            );
        }

        userLog.info({ alertId }, "alert sent to slack");
        return NextResponse.json(
            { success: true },
            { headers: reqHeaders }
        );
    } catch (err) {
        log.error({ err }, "unexpected error in POST /api/alerts/slack");
        Sentry.captureException(err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500, headers: reqHeaders }
        );
    }
}
