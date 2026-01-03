import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getUserId, getCurrentUser } from "@/lib/auth";
import { decryptWebhookUrl } from "@/lib/encryption";

/**
 * User Data API
 * 
 * GET /api/user/export - GDPR data export (all user data)
 * DELETE /api/user - Account deletion (removes all user data)
 */

export async function GET() {
    try {
        const userId = await getUserId();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = createServerClient();

        // Fetch all user data
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
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Sanitize settings (decrypt and redact sensitive data)
        const sanitizedSettings = user.settings ? {
            ...user.settings,
            slack_webhook_url: user.settings.slack_webhook_url
                ? "[REDACTED - Encrypted Webhook URL]"
                : null
        } : null;

        // Build export payload
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
            // Don't include full snapshot data (too large), just metadata
            snapshots_summary: (snapshots || []).slice(0, 10).map(s => ({
                id: s.id,
                competitor_id: s.competitor_id,
                created_at: s.created_at,
                region: s.region
            }))
        };

        // Return as downloadable JSON
        return new NextResponse(JSON.stringify(exportData, null, 2), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Content-Disposition": `attachment; filename="rivaleye-export-${userId}.json"`
            }
        });
    } catch (error) {
        console.error("Data export error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        const userId = await getUserId();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = createServerClient();

        // Cascade delete: snapshots → alerts → competitors → user
        // Note: In production, you'd want RLS and proper cascade constraints

        // 1. Get all competitor IDs for this user
        const { data: competitors } = await supabase
            .from("competitors")
            .select("id")
            .eq("user_id", userId);

        const competitorIds = (competitors || []).map(c => c.id);

        if (competitorIds.length > 0) {
            // 2. Delete snapshots for these competitors
            await supabase
                .from("snapshots")
                .delete()
                .in("competitor_id", competitorIds);

            // 3. Delete alerts for these competitors
            await supabase
                .from("alerts")
                .delete()
                .in("competitor_id", competitorIds);

            // 4. Delete competitors
            await supabase
                .from("competitors")
                .delete()
                .eq("user_id", userId);
        }

        // 5. Delete user record
        const { error: userDeleteError } = await supabase
            .from("users")
            .delete()
            .eq("id", userId);

        if (userDeleteError) {
            console.error("User deletion error:", userDeleteError);
            return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
        }

        // Log the deletion event
        console.log(`[GDPR] User account deleted: ${userId}`);

        return NextResponse.json({
            success: true,
            message: "Account and all associated data have been permanently deleted."
        });
    } catch (error) {
        console.error("Account deletion error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
