import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js Proxy — Auth Guard (formerly Middleware, renamed in Next.js 16)
 *
 * Protects /dashboard/* and /api/* (except public routes)
 * by checking for valid Supabase session cookies.
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
    // Exact public page matches
    if (PUBLIC_ROUTES.has(pathname)) return true;

    // Public API routes (prefix match)
    for (const route of PUBLIC_API_ROUTES) {
        if (pathname.startsWith(route)) return true;
    }

    // Static assets, _next, favicon
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

    // Skip public routes
    if (isPublicRoute(pathname)) {
        return NextResponse.next();
    }

    // Check for Supabase session cookies
    const accessToken = request.cookies.get("sb-access-token")?.value;
    const refreshToken = request.cookies.get("sb-refresh-token")?.value;

    // No session → redirect to login (pages) or 401 (API)
    if (!accessToken || !refreshToken) {
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

    // Set security headers on all responses
    const response = NextResponse.next();

    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all paths except:
         * - _next/static (static files)
         * - _next/image (image optimization)
         * - favicon.ico
         */
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
};
