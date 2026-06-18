import { NextRequest, NextResponse } from "next/server";
import { CustomerPortal } from "@dodopayments/nextjs";
import { getUserId } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";

/**
 * Customer Billing Portal (SEC-2 hardened)
 *
 * Dodo's CustomerPortal() handler reads `customer_id` straight from the
 * query string with no ownership check — meaning anyone could open another
 * tenant's billing portal (invoices, cancel sub, payment method) via
 * `?customer_id=cus_<victim>`. That is a billing IDOR.
 *
 * This wrapper requires an authenticated session, resolves the caller's OWN
 * dodo_customer_id from our DB, and overrides any client-supplied value
 * before delegating to Dodo. The query param is never trusted.
 */
const dodoPortal = CustomerPortal({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
    environment: process.env.DODO_PAYMENTS_ENVIRONMENT as "test_mode" | "live_mode",
});

export async function GET(request: NextRequest) {
    const userId = await getUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerClient();
    const { data: user } = await supabase
        .from("users")
        .select("dodo_customer_id")
        .eq("id", userId)
        .single();

    if (!user?.dodo_customer_id) {
        return NextResponse.json(
            { error: "No billing account found for this user" },
            { status: 400 }
        );
    }

    // Force the customer_id to the authenticated user's own id, discarding
    // any attacker-supplied value from the incoming query string.
    const safeUrl = new URL(request.url);
    safeUrl.searchParams.set("customer_id", user.dodo_customer_id);

    return dodoPortal(new NextRequest(safeUrl, { method: "GET" }));
}
