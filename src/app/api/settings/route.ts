import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import type { UserSettings } from "@/lib/types";
import { DEFAULT_USER_SETTINGS } from "@/lib/types";
import { encryptWebhookUrl, decryptWebhookUrl } from "@/lib/encryption";
import { parseBody, updateSettingsSchema } from "@/lib/validation/schemas";
import { assertSameOrigin } from "@/lib/csrf";
import { withRequestId, withUser } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

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

        // Decrypt webhook URL for client display (masked)
        if (settings.slack_webhook_url) {
            const decrypted = decryptWebhookUrl(settings.slack_webhook_url);
            // Return masked version for security
            settings.slack_webhook_url = decrypted ? "••••••••" + decrypted.slice(-20) : null;
        }

        return NextResponse.json({ settings });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    const { log, headers: reqHeaders } = withRequestId(request, "PATCH /api/settings");
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

        const parsed = await parseBody(request, updateSettingsSchema);
        if (parsed.error) {
            return NextResponse.json(
                await parsed.error.json(),
                { status: 400, headers: reqHeaders }
            );
        }
        const updates: Partial<UserSettings> = {};

        if (parsed.data.email_enabled !== undefined) {
            updates.email_enabled = parsed.data.email_enabled;
        }
        if (parsed.data.digest_frequency !== undefined) {
            updates.digest_frequency = parsed.data.digest_frequency;
        }
        if (parsed.data.slack_webhook_url !== undefined) {
            // Empty string → null (cleared)
            if (parsed.data.slack_webhook_url === "" || parsed.data.slack_webhook_url === null) {
                updates.slack_webhook_url = null;
            } else {
                const encrypted = encryptWebhookUrl(parsed.data.slack_webhook_url);
                if (!encrypted) {
                    userLog.error("encryption failed for slack webhook");
                    return NextResponse.json(
                        { error: "Failed to secure webhook URL. Please try again." },
                        { status: 500, headers: reqHeaders }
                    );
                }
                updates.slack_webhook_url = encrypted;
            }
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json(
                { error: "No valid fields to update" },
                { status: 400, headers: reqHeaders }
            );
        }

        const supabase = createServerClient();
        const { data: currentUser } = await supabase
            .from("users")
            .select("settings")
            .eq("id", userId)
            .single();

        const currentSettings = currentUser?.settings || DEFAULT_USER_SETTINGS;
        const newSettings = { ...currentSettings, ...updates };

        const { error } = await supabase
            .from("users")
            .update({ settings: newSettings })
            .eq("id", userId);

        if (error) {
            userLog.error({ err: error }, "failed to update settings");
            Sentry.captureException(error);
            return NextResponse.json(
                { error: "Failed to update settings" },
                { status: 500, headers: reqHeaders }
            );
        }

        userLog.info({ fields: Object.keys(updates) }, "settings updated");
        return NextResponse.json(
            { settings: newSettings, message: "Settings updated" },
            { headers: reqHeaders }
        );
    } catch (err) {
        log.error({ err }, "unexpected error in PATCH /api/settings");
        Sentry.captureException(err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500, headers: reqHeaders }
        );
    }
}
