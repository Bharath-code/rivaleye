import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Auth Logout API
 * 
 * Clears the auth cookies.
 */

export async function POST() {
    try {
        const cookieStore = await cookies();

        cookieStore.delete("sb-access-token");
        cookieStore.delete("sb-refresh-token");

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Logout error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
