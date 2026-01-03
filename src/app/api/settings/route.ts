import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import type { UserSettings } from "@/lib/types";
import { DEFAULT_USER_SETTINGS } from "@/lib/types";

/**
 * Settings API
 *
 * GET - Return user settings
 * PATCH - Update user settings
 */

export async function GET() {
    try {
        const userId = await getUserId();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = createServerClient();

        // Try to fetch settings - may fail if column doesn't exist yet
        const { data: user, error } = await supabase
            .from("users")
            .select("settings")
            .eq("id", userId)
            .single();

        // If error (likely column doesn't exist), return defaults
        if (error) {
            console.warn("Settings column may not exist yet, returning defaults:", error.message);
            return NextResponse.json({ settings: DEFAULT_USER_SETTINGS });
        }

        // Merge with defaults to ensure all fields exist
        const settings: UserSettings = {
            ...DEFAULT_USER_SETTINGS,
            ...(user?.settings || {}),
        };

        return NextResponse.json({ settings });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const userId = await getUserId();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const updates: Partial<UserSettings> = {};

        // Validate and extract allowed fields
        if (typeof body.email_enabled === "boolean") {
            updates.email_enabled = body.email_enabled;
        }

        if (body.digest_frequency && ["instant", "daily", "weekly"].includes(body.digest_frequency)) {
            updates.digest_frequency = body.digest_frequency;
        }

        if (body.slack_webhook_url !== undefined) {
            // Validate Slack webhook URL format if provided
            if (body.slack_webhook_url === null || body.slack_webhook_url === "") {
                updates.slack_webhook_url = null;
            } else if (typeof body.slack_webhook_url === "string" && body.slack_webhook_url.startsWith("https://hooks.slack.com/")) {
                updates.slack_webhook_url = body.slack_webhook_url;
            } else {
                return NextResponse.json(
                    { error: "Invalid Slack webhook URL. Must start with https://hooks.slack.com/" },
                    { status: 400 }
                );
            }
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
        }

        const supabase = createServerClient();

        // Get current settings and merge
        const { data: currentUser } = await supabase
            .from("users")
            .select("settings")
            .eq("id", userId)
            .single();

        const currentSettings = currentUser?.settings || DEFAULT_USER_SETTINGS;
        const newSettings = { ...currentSettings, ...updates };

        // Update settings
        const { error } = await supabase
            .from("users")
            .update({ settings: newSettings })
            .eq("id", userId);

        if (error) {
            console.error("Error updating settings:", error);
            return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
        }

        return NextResponse.json({ settings: newSettings, message: "Settings updated" });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
