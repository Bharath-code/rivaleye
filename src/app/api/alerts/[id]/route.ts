import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";

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
    try {
        const userId = await getUserId();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
            return NextResponse.json({ error: "Alert not found" }, { status: 404 });
        }

        return NextResponse.json({ alert });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getUserId();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { is_read, is_dismissed } = body;

        const supabase = createServerClient();

        // Verify the alert belongs to user
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
            return NextResponse.json({ error: "Alert not found" }, { status: 404 });
        }

        // Update the alert
        const updates: { is_read?: boolean; is_dismissed?: boolean } = {};
        if (typeof is_read === "boolean") updates.is_read = is_read;
        if (typeof is_dismissed === "boolean") updates.is_dismissed = is_dismissed;

        const { error: updateError } = await supabase
            .from("alerts")
            .update(updates)
            .eq("id", id);

        if (updateError) {
            console.error("Error updating alert:", updateError);
            return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
