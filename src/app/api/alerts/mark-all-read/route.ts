import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";

/**
 * Mark All Alerts Read API
 *
 * POST - Mark all user's alerts as read
 */

export async function POST() {
    try {
        const userId = await getUserId();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = createServerClient();

        // Get all competitor IDs for this user
        const { data: competitors, error: compError } = await supabase
            .from("competitors")
            .select("id")
            .eq("user_id", userId);

        if (compError) {
            console.error("Error fetching competitors:", compError);
            return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
        }

        if (!competitors?.length) {
            return NextResponse.json({ marked: 0 });
        }

        const competitorIds = competitors.map((c) => c.id);

        // Mark all alerts as read
        const { error: updateError, count } = await supabase
            .from("alerts")
            .update({ is_read: true })
            .in("competitor_id", competitorIds)
            .eq("is_read", false);

        if (updateError) {
            console.error("Error updating alerts:", updateError);
            return NextResponse.json({ error: "Failed to mark alerts" }, { status: 500 });
        }

        return NextResponse.json({ success: true, marked: count || 0 });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
