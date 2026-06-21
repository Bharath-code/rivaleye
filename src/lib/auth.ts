import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { User } from "@/lib/types";
import { requireSupabaseUrl, requireSupabasePublishableKey } from "./supabaseEnv";

/**
 * Auth Helper
 *
 * Provides utilities for authentication in server components and API routes.
 *
 * Token strategy:
 * - sb-access-token: 1h (Supabase JWT expiry)
 * - sb-refresh-token: 30d (used by /api/auth/refresh to mint new access tokens)
 *
 * When the access token expires, getCurrentUser() automatically calls
 * supabase.auth.refreshSession() with the refresh token and rotates both
 * cookies. This prevents the "silent 1-hour logout" bug where users got
 * booted after 1h of use.
 */

/**
 * Create a Supabase client for server-side auth operations.
 *
 * Throws if no client key is configured. Accepts either the canonical
 * NEXT_PUBLIC_SUPABASE_ANON_KEY or the newer publishable key name via the
 * shared resolver in supabaseEnv.
 */
export function createAuthClient() {
    return createClient(
        requireSupabaseUrl(),
        requireSupabasePublishableKey(),
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );
}

/**
 * Refresh the access token using the refresh token from cookies.
 * Returns the new access token on success, null on failure.
 * Side effect: writes new cookies via the Next.js cookies() API.
 */
async function refreshAccessToken(): Promise<string | null> {
    try {
        const cookieStore = await cookies();
        const refreshToken = cookieStore.get("sb-refresh-token")?.value;

        if (!refreshToken) return null;

        const supabase = createAuthClient();
        const { data, error } = await supabase.auth.refreshSession({
            refresh_token: refreshToken,
        });

        if (error || !data.session) {
            // Refresh token is invalid/expired — clear cookies so the next
            // request goes through proxy.ts and gets redirected to /login
            cookieStore.delete("sb-access-token");
            cookieStore.delete("sb-refresh-token");
            return null;
        }

        cookieStore.set("sb-access-token", data.session.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60, // 1 hour
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

        return data.session.access_token;
    } catch {
        return null;
    }
}

/**
 * Get the current authenticated user from the session.
 * Returns null if not authenticated.
 *
 * If the access token is expired, automatically attempts one refresh
 * before giving up. This is the fix for the silent-logout-after-1h bug.
 */
export async function getCurrentUser(): Promise<User | null> {
    try {
        const cookieStore = await cookies();
        let accessToken = cookieStore.get("sb-access-token")?.value;
        const refreshToken = cookieStore.get("sb-refresh-token")?.value;

        if (!accessToken && !refreshToken) {
            return null;
        }

        const supabase = createAuthClient();

        // If no access token, try refreshing first
        if (!accessToken && refreshToken) {
            const refreshed = await refreshAccessToken();
            if (!refreshed) return null;
            accessToken = refreshed;
        }

        let {
            data: { user: authUser },
            error,
        } = await supabase.auth.getUser(accessToken!);

        // Access token expired → try refreshing once
        if (error && refreshToken) {
            const isExpired =
                error.message?.toLowerCase().includes("expired") ||
                error.message?.toLowerCase().includes("invalid") ||
                error.status === 401;

            if (isExpired) {
                const newToken = await refreshAccessToken();
                if (newToken) {
                    const retry = await supabase.auth.getUser(newToken);
                    authUser = retry.data.user;
                    error = retry.error;
                }
            }
        }

        if (error || !authUser) {
            return null;
        }

        // Fetch user record from our users table
        const { data: user } = await supabase
            .from("users")
            .select("*")
            .eq("id", authUser.id)
            .single();

        if (!user) {
            // User exists in auth but not in our table — create record
            const { data: newUser } = await supabase
                .from("users")
                .insert({
                    id: authUser.id,
                    email: authUser.email!,
                    plan: "free",
                    subscription_status: "none",
                })
                .select()
                .single();

            return newUser as User;
        }

        return user as User;
    } catch {
        return null;
    }
}

/**
 * Check if user is authenticated (lightweight check, no DB)
 */
export async function isAuthenticated(): Promise<boolean> {
    const cookieStore = await cookies();
    return !!cookieStore.get("sb-access-token")?.value;
}

/**
 * Get user ID from session (fast, doesn't hit DB).
 * Returns null if no valid session.
 */
export async function getUserId(): Promise<string | null> {
    try {
        const cookieStore = await cookies();
        let accessToken = cookieStore.get("sb-access-token")?.value;
        const refreshToken = cookieStore.get("sb-refresh-token")?.value;

        if (!accessToken && !refreshToken) return null;

        const supabase = createAuthClient();

        if (!accessToken && refreshToken) {
            const refreshed = await refreshAccessToken();
            if (!refreshed) return null;
            accessToken = refreshed;
        }

        const {
            data: { user },
            error,
        } = await supabase.auth.getUser(accessToken!);

        if (error || !user) return null;

        return user.id;
    } catch {
        return null;
    }
}
