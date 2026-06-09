import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

/**
 * Auth Refresh API
 *
 * Exchanges a valid refresh token for a new access token + refresh token.
 * Called by proxy.ts when an upstream API returns 401 due to expired JWT.
 *
 * Cookie strategy:
 * - sb-access-token: 1h (matches Supabase JWT expiry)
 * - sb-refresh-token: 30d (long-lived, used to mint new access tokens)
 */

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const refreshToken = cookieStore.get("sb-refresh-token")?.value;

        if (!refreshToken) {
            return NextResponse.json(
                { error: "No refresh token" },
                { status: 401 }
            );
        }

        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
            return NextResponse.json(
                { error: "Supabase not configured" },
                { status: 500 }
            );
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );

        const { data, error } = await supabase.auth.refreshSession({
            refresh_token: refreshToken,
        });

        if (error || !data.session) {
            // Refresh token is invalid/expired — clear cookies so user re-auths
            cookieStore.delete("sb-access-token");
            cookieStore.delete("sb-refresh-token");

            return NextResponse.json(
                { error: "Refresh token invalid", needsReauth: true },
                { status: 401 }
            );
        }

        // Rotate both cookies with fresh tokens
        cookieStore.set("sb-access-token", data.session.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60, // 1 hour — matches JWT expiry
            path: "/",
        });

        if (data.session.refresh_token) {
            cookieStore.set("sb-refresh-token", data.session.refresh_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 60 * 60 * 24 * 30, // 30 days
                path: "/",
            });
        }

        return NextResponse.json({
            success: true,
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: data.session.expires_at,
        });
    } catch (err) {
        console.error("[Auth Refresh] Error:", err);
        return NextResponse.json(
            { error: "Server error" },
            { status: 500 }
        );
    }
}
