import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";

/**
 * Competitor Update API
 *
 * PATCH /api/competitors/[id] - Update competitor name/URL
 * 
 * If URL changes, all historical data (snapshots, alerts) is reset
 * to maintain data integrity and prevent misuse.
 */

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const userId = await getUserId();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        if (!id) {
            return NextResponse.json(
                { error: "Competitor ID is required" },
                { status: 400 }
            );
        }

        const body = await request.json();
        const { name, url } = body;

        // At least one field must be provided
        if (!name && !url) {
            return NextResponse.json(
                { error: "Name or URL is required" },
                { status: 400 }
            );
        }

        // Validate URL format if provided
        if (url) {
            try {
                new URL(url);
            } catch {
                return NextResponse.json(
                    { error: "Invalid URL format" },
                    { status: 400 }
                );
            }
        }

        const supabase = createServerClient();

        // Fetch current competitor and verify ownership
        const { data: competitor, error: fetchError } = await supabase
            .from("competitors")
            .select("*")
            .eq("id", id)
            .single();

        if (fetchError || !competitor) {
            return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
        }

        if (competitor.user_id !== userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Check if URL is changing
        const urlIsChanging = url && url !== competitor.url;
        let historyReset = false;

        if (urlIsChanging) {
            // Delete all snapshots for this competitor
            const { error: snapshotDeleteError } = await supabase
                .from("snapshots")
                .delete()
                .eq("competitor_id", id);

            if (snapshotDeleteError) {
                console.error("Error deleting snapshots:", snapshotDeleteError);
                // Non-fatal: continue with update
            }

            // Delete all alerts for this competitor
            const { error: alertDeleteError } = await supabase
                .from("alerts")
                .delete()
                .eq("competitor_id", id);

            if (alertDeleteError) {
                console.error("Error deleting alerts:", alertDeleteError);
                // Non-fatal: continue with update
            }

            historyReset = true;
            console.log(`[Competitors] URL changed for ${competitor.name}, history reset`);
        }

        // Prepare update payload
        const updatePayload: Record<string, unknown> = {};

        if (name) {
            updatePayload.name = name;
        }

        if (url) {
            updatePayload.url = url;
        }

        // If URL changed, reset tracking fields
        if (urlIsChanging) {
            updatePayload.last_checked_at = null;
            updatePayload.failure_count = 0;
            updatePayload.status = "active";
        }

        // Update competitor
        const { data: updatedCompetitor, error: updateError } = await supabase
            .from("competitors")
            .update(updatePayload)
            .eq("id", id)
            .select()
            .single();

        if (updateError) {
            console.error("Error updating competitor:", updateError);
            return NextResponse.json({ error: "Failed to update competitor" }, { status: 500 });
        }

        return NextResponse.json({
            competitor: updatedCompetitor,
            historyReset,
            message: historyReset
                ? "Competitor updated. Historical data has been reset due to URL change."
                : "Competitor updated successfully."
        });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
