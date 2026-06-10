import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js Proxy — Auth Guard (formerly Middleware, renamed in Next.js 16)
 *
 * Layer 1 of auth defense:
 * - Blocks unauthenticated requests to /dashboard/* and protected /api/* routes
 * - Sets security headers on all responses (CSP, HSTS, X-Frame-Options, etc.)
 *
 * Token refresh happens in lib/auth.ts:getCurrentUser() at the server-component
 * / API-route level (where cookies() writes are visible to the response).
 * The proxy is intentionally lightweight — it only checks cookie presence,
 * not JWT validity, because JWT validation requires a Supabase round-trip
 * we don't want on every static asset request.
 */

const PUBLIC_ROUTES = new Set([
    "/",
    "/login",
    "/auth",
    "/auth/callback",
    "/track",
]);

const PUBLIC_API_ROUTES = new Set([
    "/api/webhook",
    "/api/auth",
    "/api/checkout",
    "/api/public",
    // Note: /api/cron removed — handler deleted, no callers. Daily jobs
    // run via Trigger.dev schedules (src/trigger/dailyAnalysis.ts,
    // src/trigger/dailyPricingAnalysis.ts), not via Next API routes.
    // AEO routes require auth — handled inside each route via getUserId()
]);

function isPublicRoute(pathname: string): boolean {
    if (PUBLIC_ROUTES.has(pathname)) return true;

    // Public tracker pages (viral wedge): /track/[slug]
    if (pathname.startsWith("/track/")) return true;

    for (const route of PUBLIC_API_ROUTES) {
        if (pathname.startsWith(route)) return true;
    }

    if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon") ||
        pathname.startsWith("/public") ||
        pathname.includes(".")
    ) {
        return true;
    }

    return false;
}

const SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    },
];

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (isPublicRoute(pathname)) {
        return setSecurityHeaders(NextResponse.next());
    }

    const accessToken = request.cookies.get("sb-access-token")?.value;
    const refreshToken = request.cookies.get("sb-refresh-token")?.value;

    if (!accessToken && !refreshToken) {
        if (pathname.startsWith("/api/")) {
            return setSecurityHeaders(
                NextResponse.json(
                    { error: "Unauthorized" },
                    { status: 401 }
                )
            );
        }
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        return setSecurityHeaders(NextResponse.redirect(loginUrl));
    }

    return setSecurityHeaders(NextResponse.next());
}

function setSecurityHeaders(response: NextResponse): NextResponse {
    for (const { key, value } of SECURITY_HEADERS) {
        response.headers.set(key, value);
    }
    // HSTS only in prod (no effect on localhost)
    if (process.env.NODE_ENV === "production") {
        response.headers.set(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains; preload"
        );
    }
    return response;
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
};
