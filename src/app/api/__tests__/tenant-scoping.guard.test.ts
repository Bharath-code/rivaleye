import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * SEC-3 tenant-scoping guard.
 *
 * Every API route uses the service-role Supabase client, which BYPASSES RLS.
 * That means RLS will not save a route that forgets to scope a tenant query by
 * the authenticated user — such a route is a cross-tenant IDOR.
 *
 * This test fails if any route that queries a tenant table neither scopes by
 * `user_id` nor is explicitly allowlisted as intentionally non-user-scoped
 * (public endpoints, signed webhooks, billing handlers, auth flows).
 *
 * If you add a route to the allowlist, you are asserting it is SAFE to run
 * without a user_id predicate — review it carefully.
 */

const API_DIR = join(process.cwd(), "src", "app", "api");

// Tables that hold per-user (tenant) data and must be scoped by user.
const TENANT_TABLES = [
    "competitors",
    "analyses",
    "alerts",
    "snapshots",
    "pricing_snapshots",
    "aeo_visibility",
    "user_settings",
];

// Routes intentionally NOT scoped by user_id. Each entry is a justification.
const ALLOWLIST: Record<string, string> = {
    "public/competitor/[slug]/route.ts": "public tracker — returns public-safe fields only, filtered by public_listed",
    "webhook/route.ts": "Dodo webhook — HMAC-signed, matches by customer email",
    "checkout/route.ts": "Dodo checkout handler — no tenant query",
    "customer-portal/route.ts": "resolves customer_id from session (SEC-2); no raw tenant query",
    "auth/sync/route.ts": "auth cookie sync — no tenant table query",
    "auth/refresh/route.ts": "token refresh — no tenant table query",
    "auth/logout/route.ts": "logout — no tenant table query",
    "monitoring/route.ts": "health/monitoring endpoint",
};

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...walk(full));
        else if (entry === "route.ts") out.push(full);
    }
    return out;
}

function rel(p: string): string {
    return p.slice(API_DIR.length + 1);
}

describe("SEC-3: tenant-scoping guard", () => {
    const routes = walk(API_DIR);

    it("finds API routes to check", () => {
        expect(routes.length).toBeGreaterThan(0);
    });

    for (const route of routes) {
        const key = rel(route);
        const src = readFileSync(route, "utf8");

        const touchesTenantTable = TENANT_TABLES.some((t) =>
            src.includes(`.from("${t}")`) || src.includes(`.from('${t}')`)
        );

        if (!touchesTenantTable) continue;

        it(`${key} scopes tenant queries by user_id (or is allowlisted)`, () => {
            if (key in ALLOWLIST) {
                expect(ALLOWLIST[key]).toBeTruthy();
                return;
            }
            const scoped =
                src.includes("user_id") &&
                (src.includes("getUserId") || src.includes("getCurrentUser"));
            expect(
                scoped,
                `${key} queries a tenant table but does not scope by an authenticated user_id. ` +
                `Add a .eq("user_id", userId) predicate, or allowlist it with a justification.`
            ).toBe(true);
        });
    }
});
