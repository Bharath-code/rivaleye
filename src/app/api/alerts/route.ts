import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";

/**
 * Alerts API
 *
 * GET - List user's alerts
 */

export async function GET() {
    try {
        const userId = await getUserId();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = createServerClient();

        // Get alerts for user's competitors
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
            console.error("Error fetching alerts:", error);
            return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
        }

        return NextResponse.json({ alerts });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
