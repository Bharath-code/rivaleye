import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertSameOrigin } from "@/lib/csrf";
import { withRequestId } from "@/lib/logger";

/**
 * Auth Logout API
 *
 * Clears the auth cookies. Requires CSRF check (state-changing).
 */

export async function POST(request: NextRequest) {
    const { log, headers: reqHeaders } = withRequestId(request, "POST /api/auth/logout");
    try {
        const csrf = assertSameOrigin(request);
        if (csrf) return csrf;

        const cookieStore = await cookies();

        cookieStore.delete("sb-access-token");
        cookieStore.delete("sb-refresh-token");

        log.info("user logged out");
        return NextResponse.json({ success: true }, { headers: reqHeaders });
    } catch (err) {
        log.error({ err }, "logout error");
        return NextResponse.json(
            { error: "Server error" },
            { status: 500, headers: reqHeaders }
        );
    }
}
