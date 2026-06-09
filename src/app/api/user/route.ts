import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { withRequestId, withUser } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

/**
 * User Data API
 *
 * GET /api/user - GDPR data export (all user data)
 * DELETE /api/user - Account deletion (removes all user data)
 */

export async function GET(request: NextRequest) {
    const { log, headers: reqHeaders } = withRequestId(request, "GET /api/user");
    try {
        const userId = await getUserId();

        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401, headers: reqHeaders }
            );
        }

        const supabase = createServerClient();

        const [
            { data: user },
            { data: competitors },
            { data: alerts },
            { data: snapshots }
        ] = await Promise.all([
            supabase.from("users").select("*").eq("id", userId).single(),
            supabase.from("competitors").select("*").eq("user_id", userId),
            supabase.from("alerts").select("*, competitors!inner(user_id)").eq("competitors.user_id", userId),
            supabase.from("snapshots").select("*, competitors!inner(user_id)").eq("competitors.user_id", userId)
        ]);

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404, headers: reqHeaders }
            );
        }

        const sanitizedSettings = user.settings ? {
            ...user.settings,
            slack_webhook_url: user.settings.slack_webhook_url
                ? "[REDACTED - Encrypted Webhook URL]"
                : null
        } : null;

        const exportData = {
            exportedAt: new Date().toISOString(),
            user: {
                id: user.id,
                email: user.email,
                plan: user.plan,
                subscription_status: user.subscription_status,
                created_at: user.created_at,
                settings: sanitizedSettings
            },
            competitors: (competitors || []).map(c => ({
                id: c.id,
                name: c.name,
                url: c.url,
                status: c.status,
                created_at: c.created_at,
                last_checked_at: c.last_checked_at
            })),
            alerts: (alerts || []).map(a => ({
                id: a.id,
                type: a.type,
                severity: a.severity,
                title: a.title,
                description: a.description,
                created_at: a.created_at,
                is_read: a.is_read
            })),
            snapshots_count: snapshots?.length || 0,
            snapshots_summary: (snapshots || []).slice(0, 10).map(s => ({
                id: s.id,
                competitor_id: s.competitor_id,
                created_at: s.created_at,
                region: s.region
            }))
        };

        return new NextResponse(JSON.stringify(exportData, null, 2), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Content-Disposition": `attachment; filename="rivaleye-export-${userId}.json"`,
                ...reqHeaders,
            },
        });
    } catch (err) {
        log.error({ err }, "data export error");
        Sentry.captureException(err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500, headers: reqHeaders }
        );
    }
}

export async function DELETE(request: NextRequest) {
    const { log, headers: reqHeaders } = withRequestId(request, "DELETE /api/user");
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

        const { data: competitors } = await supabase
            .from("competitors")
            .select("id")
            .eq("user_id", userId);

        const competitorIds = (competitors || []).map(c => c.id);

        if (competitorIds.length > 0) {
            await supabase
                .from("snapshots")
                .delete()
                .in("competitor_id", competitorIds);

            await supabase
                .from("alerts")
                .delete()
                .in("competitor_id", competitorIds);

            await supabase
                .from("competitors")
                .delete()
                .eq("user_id", userId);
        }

        const { error: userDeleteError } = await supabase
            .from("users")
            .delete()
            .eq("id", userId);

        if (userDeleteError) {
            userLog.error({ err: userDeleteError }, "user deletion failed");
            Sentry.captureException(userDeleteError);
            return NextResponse.json(
                { error: "Failed to delete account" },
                { status: 500, headers: reqHeaders }
            );
        }

        userLog.warn("user account deleted (GDPR)");
        return NextResponse.json(
            {
                success: true,
                message: "Account and all associated data have been permanently deleted.",
            },
            { headers: reqHeaders }
        );
    } catch (err) {
        log.error({ err }, "account deletion error");
        Sentry.captureException(err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500, headers: reqHeaders }
        );
    }
}
