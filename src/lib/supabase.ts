import { createClient } from "@supabase/supabase-js";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
}

const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable");
}

const resolvedSupabaseAnonKey: string = supabaseAnonKey;

/**
 * Client-side Supabase client
 * 
 * Configured with:
 * - autoRefreshToken: true (automatically refresh tokens before expiry)
 * - persistSession: true (store session in localStorage)
 * - detectSessionInUrl: true (handle OAuth callbacks)
 */
export const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    resolvedSupabaseAnonKey,
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

// Server-side client with service role key (for API routes/server actions)
// ⚠️ MUST use service role key to bypass RLS for server operations
export function createServerClient() {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
        console.warn("SUPABASE_SERVICE_ROLE_KEY not set, using publishable key (RLS will apply)");
        // Fallback to publishable key if service role not available
        return createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            resolvedSupabaseAnonKey,
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
