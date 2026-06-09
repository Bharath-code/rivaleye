import { NextResponse } from "next/server";
import { getAllowedOrigins } from "@/lib/validation/schemas";

/**
 * CSRF Origin Check
 *
 * Rejects POST/PATCH/DELETE requests whose Origin header doesn't
 * match the allowed allowlist. Defends against:
 *  - Classic CSRF (malicious page submits a form to rivaleye.com)
 *  - DNS rebinding attacks
 *  - Cross-origin XHR/fetch abuse
 *
 * Safe methods (GET, HEAD, OPTIONS) are not checked.
 *
 * Usage:
 *   import { assertSameOrigin } from "@/lib/csrf";
 *
 *   export async function POST(request: NextRequest) {
 *       const csrf = assertSameOrigin(request);
 *       if (csrf) return csrf;
 *       // ... handler
 *   }
 *
 * Note: This is defense-in-depth. The auth cookie is httpOnly + sameSite=lax
 * which already mitigates most CSRF; this adds Origin validation on top.
 */
export function assertSameOrigin(request: Request): NextResponse | null {
    const method = request.method.toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
        return null;
    }

    const origin = request.headers.get("origin") || request.headers.get("referer");
    if (!origin) {
        return NextResponse.json(
            { error: "Origin or Referer header required" },
            { status: 403 }
        );
    }

    const allowed = getAllowedOrigins();
    if (allowed.length === 0) {
        // No allowlist configured — fail open in dev, closed in prod
        if (process.env.NODE_ENV === "production") {
            return NextResponse.json(
                { error: "CSRF: no allowed origins configured" },
                { status: 403 }
            );
        }
        return null;
    }

    // Compare origins (not full URLs — protocol + host + port)
    const requestOrigin = (() => {
        try {
            return new URL(origin).origin;
        } catch {
            return origin;
        }
    })();

    const isAllowed = allowed.some((allowedOrigin) => {
        try {
            return new URL(allowedOrigin).origin === requestOrigin;
        } catch {
            return false;
        }
    });

    if (!isAllowed) {
        return NextResponse.json(
            { error: "Forbidden: cross-origin request blocked" },
            { status: 403 }
        );
    }

    return null;
}

/**
 * Assert the request comes from a server-to-server webhook (Dodo, Stripe, etc.).
 *
 * Webhooks don't send Origin headers — they sign their payloads with HMAC.
 * Use this in place of assertSameOrigin for webhook handlers that have their
 * own signature verification (Dodo Webhooks() helper handles this for us).
 */
export function assertNoBrowserOrigin(request: Request): NextResponse | null {
    const method = request.method.toUpperCase();
    if (method !== "POST") return null;

    const origin = request.headers.get("origin");
    if (!origin) return null; // Server-to-server, no origin

    // If origin IS present, it must be in our allowlist (defense-in-depth)
    return assertSameOrigin(request);
}
