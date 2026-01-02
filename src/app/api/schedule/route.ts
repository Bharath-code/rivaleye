import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";

/**
 * POST /api/schedule
 * 
 * Create or update a user's analysis schedule based on their plan.
 */
export async function POST(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { plan = "free", timezone = "UTC" } = body;

        // Validate plan
        if (!["free", "pro", "enterprise"].includes(plan)) {
            return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
        }

        // Import trigger functions (only on server)
        const { createUserSchedule } = await import("@/trigger/userSchedules");

        const result = await createUserSchedule(userId, plan, timezone);

        // Store schedule ID in database for reference
        const supabase = createServerClient();
        await supabase
            .from("users")
            .update({
                schedule_id: result.scheduleId,
                plan_type: plan,
            })
            .eq("id", userId);

        return NextResponse.json({
            success: true,
            scheduleId: result.scheduleId,
            cron: result.cron,
            plan,
            timezone,
        });
    } catch (error) {
        console.error("[Schedule API] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to create schedule" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/schedule
 * 
 * Deactivate a user's schedule (e.g., on subscription cancel)
 */
export async function DELETE(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get user's schedule ID
        const supabase = createServerClient();
        const { data: user } = await supabase
            .from("users")
            .select("schedule_id")
            .eq("id", userId)
            .single();

        if (!user?.schedule_id) {
            return NextResponse.json({ error: "No schedule found" }, { status: 404 });
        }

        const { deactivateUserSchedule } = await import("@/trigger/userSchedules");
        await deactivateUserSchedule(user.schedule_id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Schedule API] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to deactivate schedule" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/schedule
 * 
 * Get current user's schedule info
 */
export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = createServerClient();
        const { data: user } = await supabase
            .from("users")
            .select("schedule_id, plan_type")
            .eq("id", userId)
            .single();

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const cronDescriptions: Record<string, string> = {
            free: "Daily at 6 AM UTC",
            pro: "Every 6 hours",
            enterprise: "Every hour",
        };

        return NextResponse.json({
            scheduleId: user.schedule_id,
            plan: user.plan_type || "free",
            frequency: cronDescriptions[user.plan_type || "free"],
        });
    } catch (error) {
        console.error("[Schedule API] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to get schedule" },
            { status: 500 }
        );
    }
}
