import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { User } from "@/lib/types";

/**
 * Auth Helper
 *
 * Provides utilities for authentication in server components and API routes.
 */

/**
 * Create a Supabase client for server-side auth operations
 */
export function createAuthClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );
}

/**
 * Get the current authenticated user from the session
 * Returns null if not authenticated
 */
export async function getCurrentUser(): Promise<User | null> {
    try {
        const cookieStore = await cookies();
        const accessToken = cookieStore.get("sb-access-token")?.value;
        const refreshToken = cookieStore.get("sb-refresh-token")?.value;

        if (!accessToken || !refreshToken) {
            return null;
        }

        const supabase = createAuthClient();

        const {
            data: { user: authUser },
            error,
        } = await supabase.auth.getUser(accessToken);

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
 * Check if user is authenticated (lightweight check)
 */
export async function isAuthenticated(): Promise<boolean> {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("sb-access-token")?.value;
    return !!accessToken;
}

/**
 * Get user ID from session (fast, doesn't hit DB)
 */
export async function getUserId(): Promise<string | null> {
    try {
        const cookieStore = await cookies();
        const accessToken = cookieStore.get("sb-access-token")?.value;

        if (!accessToken) {
            return null;
        }

        const supabase = createAuthClient();
        const {
            data: { user },
        } = await supabase.auth.getUser(accessToken);

        return user?.id || null;
    } catch {
        return null;
    }
}
