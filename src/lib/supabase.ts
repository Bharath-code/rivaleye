import { createClient } from "@supabase/supabase-js";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error(
        "FATAL: NEXT_PUBLIC_SUPABASE_URL is required. " +
        "Set it in .env.local or your deployment environment."
    );
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
        "FATAL: NEXT_PUBLIC_SUPABASE_ANON_KEY is required. " +
        "Set it in .env.local or your deployment environment. " +
        "Do not rely on NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY — it is not configured."
    );
}

const supabaseAnonKey: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Client-side Supabase client.
 *
 * Configured to refresh tokens proactively and persist the session in
 * localStorage. The Supabase JS client also fires TOKEN_REFRESHED events
 * which we use to sync the new token into our server cookies via
 * /api/auth/sync.
 */
export const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey,
    {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            storageKey: "rivaleye-auth",
            flowType: "pkce",
        },
    }
);

// Proactively sync refreshed tokens to the server cookie store.
// Without this, the server-side cookies (read by getCurrentUser and
// getUserId) would lag behind the client session by up to 1 hour,
// causing 401s on API calls right after a silent client-side refresh.
if (typeof window !== "undefined") {
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (
            (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") &&
            session?.access_token &&
            session?.refresh_token
        ) {
            try {
                await fetch("/api/auth/sync", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        accessToken: session.access_token,
                        refreshToken: session.refresh_token,
                    }),
                    keepalive: true,
                });
            } catch {
                // Non-blocking — server cookie will re-sync on next page load
            }
        }
    });
}

/**
 * Server-side client with service role key (for API routes/server actions).
 *
 * Uses the service role key to bypass RLS for server operations.
 * Falls back to anon key (with warning) if service role is not set —
 * this allows local dev without service role, but production must set it.
 */
export function createServerClient() {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
        console.warn(
            "SUPABASE_SERVICE_ROLE_KEY not set — falling back to anon key. " +
            "RLS will apply. Set this in production to bypass RLS for server operations."
        );
        return createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            supabaseAnonKey,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            }
        );
    }

    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );
}
