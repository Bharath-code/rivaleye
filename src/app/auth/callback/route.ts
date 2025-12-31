import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Auth Callback Route
 *
 * Handles the redirect from Supabase magic link.
 * Exchanges the code for a session and sets cookies.
 */

export async function GET(request: Request) {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const next = url.searchParams.get("next") || "/dashboard";

    if (!code) {
        return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
    }

    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error || !data.session) {
            console.error("Auth callback error:", error);
            return NextResponse.redirect(new URL("/login?error=auth_failed", url.origin));
        }

        // Set cookies for session persistence
        const cookieStore = await cookies();

        cookieStore.set("sb-access-token", data.session.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: "/",
        });

        cookieStore.set("sb-refresh-token", data.session.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: "/",
        });

        // Ensure user exists in our users table
        const { createServerClient } = await import("@/lib/supabase");
        const serverSupabase = createServerClient();

        const { data: existingUser } = await serverSupabase
            .from("users")
            .select("id")
            .eq("id", data.user.id)
            .single();

        if (!existingUser) {
            await serverSupabase.from("users").insert({
                id: data.user.id,
                email: data.user.email!,
                plan: "free",
                subscription_status: "none",
            });
        }

        return NextResponse.redirect(new URL(next, url.origin));
    } catch (error) {
        console.error("Auth callback exception:", error);
        return NextResponse.redirect(new URL("/login?error=server_error", url.origin));
    }
}
