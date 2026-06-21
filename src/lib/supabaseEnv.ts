/**
 * Supabase environment resolution — single source of truth.
 *
 * Supabase renamed the legacy client-side `anon` key to a `publishable` key.
 * Both names refer to the same public (RLS-respecting) key. We accept either
 * so env naming drift can't silently break auth or the production build.
 *
 * Precedence: the canonical NEXT_PUBLIC_SUPABASE_ANON_KEY, then the newer
 * publishable name. We still fail loud if NEITHER is set — honoring the
 * original "no silent fallback to an unconfigured var" intent.
 *
 * NOTE: the literal `process.env.NEXT_PUBLIC_*` member expressions must stay
 * inline so Next.js can statically inline them into client bundles.
 */

export function getSupabaseUrl(): string | undefined {
    return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function getSupabasePublishableKey(): string | undefined {
    return (
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    );
}

export function requireSupabaseUrl(): string {
    const url = getSupabaseUrl();
    if (!url) {
        throw new Error(
            "FATAL: NEXT_PUBLIC_SUPABASE_URL is required. " +
            "Set it in .env.local or your deployment environment."
        );
    }
    return url;
}

export function requireSupabasePublishableKey(): string {
    const key = getSupabasePublishableKey();
    if (!key) {
        throw new Error(
            "FATAL: a Supabase client key is required. Set " +
            "NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY) " +
            "in .env.local or your deployment environment."
        );
    }
    return key;
}
