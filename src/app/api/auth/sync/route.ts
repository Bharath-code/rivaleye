import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase";
import { parseBody, authSyncSchema } from "@/lib/validation/schemas";

/**
 * Auth Sync API
 *
 * Syncs client-side session to server cookies.
 * Called after successful client-side auth.
 */

export async function POST(request: NextRequest) {
    try {
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
                { status: 500 }
            );
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            anonKey
        );

        const { data: { user }, error } = await supabase.auth.getUser(accessToken);

        if (error || !user) {
            return NextResponse.json({ error: "Invalid token" }, { status: 401 });
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
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Auth sync error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
