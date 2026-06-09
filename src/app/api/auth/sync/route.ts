import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase";
import { parseBody, authSyncSchema } from "@/lib/validation/schemas";
import { assertSameOrigin } from "@/lib/csrf";
import { withRequestId } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

/**
 * Auth Sync API
 *
 * Syncs client-side session to server cookies.
 * Called after successful client-side auth.
 *
 * Note: This endpoint is called immediately after sign-in BEFORE the
 * Supabase session is fully established on the server side. We still
 * run CSRF check (defense in depth) but Origin is set by the same
 * browser that just signed in.
 */

export async function POST(request: NextRequest) {
    const { log, headers: reqHeaders } = withRequestId(request, "POST /api/auth/sync");
    try {
        const csrf = assertSameOrigin(request);
        if (csrf) return csrf;

        const parsed = await parseBody(request, authSyncSchema);
        if (parsed.error) return parsed.error;
        const { accessToken, refreshToken } = parsed.data;

        // Set cookies for session persistence
        const cookieStore = await cookies();

        // Cookie TTLs:
        // - access token: 1h (matches Supabase JWT expiry)
        // - refresh token: 30d (used to mint new access tokens via /api/auth/refresh)
        cookieStore.set("sb-access-token", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60, // 1 hour
            path: "/",
        });

        cookieStore.set("sb-refresh-token", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: "/",
        });

        // Verify tokens and get user
        const { createClient } = await import("@supabase/supabase-js");
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!anonKey) {
            return NextResponse.json(
                { error: "NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured" },
                { status: 500, headers: reqHeaders }
            );
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            anonKey
        );

        const { data: { user }, error } = await supabase.auth.getUser(accessToken);

        if (error || !user) {
            log.warn({ err: error }, "invalid token in auth/sync");
            return NextResponse.json(
                { error: "Invalid token" },
                { status: 401, headers: reqHeaders }
            );
        }

        // Ensure user exists in our users table
        const serverSupabase = createServerClient();

        const { data: existingUser } = await serverSupabase
            .from("users")
            .select("id")
            .eq("id", user.id)
            .single();

        if (!existingUser) {
            await serverSupabase.from("users").insert({
                id: user.id,
                email: user.email!,
                plan: "free",
                subscription_status: "none",
                crawls_today: 0,
                manual_checks_today: 0,
                last_quota_reset: new Date().toISOString(),
            });
            log.info({ userId: user.id, email: user.email }, "new user record created");
        } else {
            log.info({ userId: user.id }, "auth sync complete (existing user)");
        }

        return NextResponse.json({ success: true }, { headers: reqHeaders });
    } catch (error) {
        log.error({ err: error }, "auth sync error");
        Sentry.captureException(error);
        return NextResponse.json(
            { error: "Server error" },
            { status: 500, headers: reqHeaders }
        );
    }
}
