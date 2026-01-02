import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getUserId, getCurrentUser } from "@/lib/auth";

/**
 * Competitors API
 *
 * GET - List user's competitors
 * POST - Add new competitor (triggers first crawl)
 * DELETE - Remove competitor
 */

/**
 * Ensures user exists in our users table (auto-creates if missing)
 */
async function ensureUserExists(userId: string): Promise<void> {
    const supabase = createServerClient();

    const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("id", userId)
        .single();

    if (!existingUser) {
        // Get user email from auth
        const user = await getCurrentUser();
        const email = user?.email || `user-${userId}@temp.local`;

        await supabase.from("users").insert({
            id: userId,
            email: email,
            plan: "free",
            subscription_status: "none",
            crawls_today: 0,
            manual_checks_today: 0,
            last_quota_reset: new Date().toISOString(),
        });

        console.log(`Created user record for ${userId}`);
    }
}

// GET /api/competitors
export async function GET() {
    try {
        const userId = await getUserId();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await ensureUserExists(userId);

        const supabase = createServerClient();

        const { data: competitors, error } = await supabase
            .from("competitors")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching competitors:", error);
            return NextResponse.json({ error: "Failed to fetch competitors" }, { status: 500 });
        }

        const { data: user } = await supabase
            .from("users")
            .select("plan")
            .eq("id", userId)
            .single();

        return NextResponse.json({
            competitors,
            plan: user?.plan || "free"
        });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// POST /api/competitors
export async function POST(request: NextRequest) {
    try {
        const userId = await getUserId();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await ensureUserExists(userId);

        const body = await request.json();
        const { name, url } = body;

        if (!name || !url) {
            return NextResponse.json(
                { error: "Name and URL are required" },
                { status: 400 }
            );
        }

        // Validate URL
        try {
            new URL(url);
        } catch {
            return NextResponse.json(
                { error: "Invalid URL format" },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        // Check user's plan limits
        const { data: user } = await supabase
            .from("users")
            .select("plan")
            .eq("id", userId)
            .single();

        const { count: existingCount } = await supabase
            .from("competitors")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId);

        const userPlan = (user?.plan || "free") as "free" | "pro" | "enterprise";
        const flags = require("@/lib/billing/featureFlags").getFeatureFlags(userPlan);

        if ((existingCount ?? 0) >= flags.maxCompetitors) {
            return NextResponse.json(
                { error: `Free plan limited to ${flags.maxCompetitors} competitor. Upgrade to Pro for more.` },
                { status: 403 }
            );
        }

        // Insert competitor
        const { data: competitor, error } = await supabase
            .from("competitors")
            .insert({
                user_id: userId,
                name,
                url,
                status: "active",
                failure_count: 0,
            })
            .select()
            .single();

        if (error) {
            console.error("Error creating competitor:", error);
            return NextResponse.json({ error: "Failed to create competitor" }, { status: 500 });
        }

        // TODO: Trigger first crawl asynchronously
        // await triggerCrawl(competitor.id);

        return NextResponse.json({ competitor }, { status: 201 });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// DELETE /api/competitors?id=xxx
export async function DELETE(request: NextRequest) {
    try {
        const userId = await getUserId();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "Competitor ID is required" },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        // Verify ownership before delete
        const { data: competitor } = await supabase
            .from("competitors")
            .select("user_id")
            .eq("id", id)
            .single();

        if (!competitor || competitor.user_id !== userId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const { error } = await supabase
            .from("competitors")
            .delete()
            .eq("id", id);

        if (error) {
            console.error("Error deleting competitor:", error);
            return NextResponse.json({ error: "Failed to delete competitor" }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
