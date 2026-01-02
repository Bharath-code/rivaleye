import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { pushToSlack } from "@/lib/alerts/slackIntegration";

/**
 * Send Alert to Slack API
 * 
 * POST /api/alerts/slack
 * Body: { alertId: string }
 */
export async function POST(req: NextRequest) {
    try {
        const { alertId } = await req.json();

        if (!alertId) {
            return NextResponse.json({ error: "Missing alertId" }, { status: 400 });
        }

        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = createServerClient();

        // Fetch alert details
        const { data: alert, error: alertError } = await supabase
            .from("alerts")
            .select("*, competitors(name, url)")
            .eq("id", alertId)
            .single();

        if (alertError || !alert) {
            return NextResponse.json({ error: "Alert not found" }, { status: 404 });
        }

        // check if user is pro (security check)
        const { data: userData } = await supabase.from("users").select("plan").eq("id", userId).single();
        if (userData?.plan !== 'pro' && userData?.plan !== 'enterprise') {
            return NextResponse.json({ error: "Pro plan required for Slack integration" }, { status: 403 });
        }

        // Parse details for Slack
        const details = alert.details || {};
        const insight = typeof alert.ai_insight === 'string' ? JSON.parse(alert.ai_insight) : alert.ai_insight;

        const result = await pushToSlack({
            title: alert.title,
            description: alert.description,
            competitorName: alert.competitors.name,
            link: `${process.env.NEXT_PUBLIC_APP_URL || 'https://rivaleye.com'}/dashboard/alerts/${alert.id}`,
            playbook: {
                salesDraft: details.tacticalPlaybook?.salesDraft || insight?.tacticalPlaybook?.salesDraft
            }
        });

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("[Slack API] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
