import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js Proxy — Auth Guard (formerly Middleware, renamed in Next.js 16)
 *
 * Layer 1 of auth defense:
 * - Blocks unauthenticated requests to /dashboard/* and protected /api/* routes
 * - Sets security headers on all responses
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
]);

const PUBLIC_API_ROUTES = new Set([
    "/api/webhook",
    "/api/auth",
    "/api/checkout",
    "/api/cron",
]);

function isPublicRoute(pathname: string): boolean {
    if (PUBLIC_ROUTES.has(pathname)) return true;

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

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (isPublicRoute(pathname)) {
        return setSecurityHeaders(NextResponse.next());
    }

    const accessToken = request.cookies.get("sb-access-token")?.value;
    const refreshToken = request.cookies.get("sb-refresh-token")?.value;

    // No session cookies at all → redirect/401
    if (!accessToken && !refreshToken) {
        if (pathname.startsWith("/api/")) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(loginUrl);
    }

    return setSecurityHeaders(NextResponse.next());
}

function setSecurityHeaders(response: NextResponse): NextResponse {
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    return response;
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
};
