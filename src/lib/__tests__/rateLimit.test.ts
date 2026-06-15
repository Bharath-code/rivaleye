import { describe, it, expect } from "vitest";
import { checkRateLimit, rateLimitHeaders, type RateLimitConfig } from "../rateLimit";

/**
 * Tests the in-memory fallback path (no UPSTASH_* env in the test runner).
 * The Redis path is exercised in integration against a live Upstash instance.
 */

const cfg: RateLimitConfig = { maxRequests: 3, windowMs: 60_000 };
const key = () => `test:${Math.random()}`;

describe("checkRateLimit (in-memory fallback)", () => {
    it("allows up to maxRequests, then blocks", async () => {
        const k = key();
        const r1 = await checkRateLimit(k, cfg);
        const r2 = await checkRateLimit(k, cfg);
        const r3 = await checkRateLimit(k, cfg);
        const r4 = await checkRateLimit(k, cfg);

        expect(r1.allowed).toBe(true);
        expect(r2.allowed).toBe(true);
        expect(r3.allowed).toBe(true);
        expect(r4.allowed).toBe(false);
    });

    it("decrements remaining and reports zero when blocked", async () => {
        const k = key();
        const first = await checkRateLimit(k, cfg);
        expect(first.remaining).toBe(2);

        await checkRateLimit(k, cfg);
        await checkRateLimit(k, cfg);
        const blocked = await checkRateLimit(k, cfg);
        expect(blocked.allowed).toBe(false);
        expect(blocked.remaining).toBe(0);
        expect(blocked.resetMs).toBeGreaterThan(0);
    });

    it("isolates limits per key", async () => {
        const a = key();
        const b = key();
        await checkRateLimit(a, cfg);
        await checkRateLimit(a, cfg);
        await checkRateLimit(a, cfg);
        const aBlocked = await checkRateLimit(a, cfg);
        const bAllowed = await checkRateLimit(b, cfg);
        expect(aBlocked.allowed).toBe(false);
        expect(bAllowed.allowed).toBe(true);
    });

    it("builds standard rate-limit headers", () => {
        const headers = rateLimitHeaders({ allowed: true, remaining: 2, resetMs: 60_000 }, cfg);
        expect(headers["X-RateLimit-Limit"]).toBe("3");
        expect(headers["X-RateLimit-Remaining"]).toBe("2");
        expect(headers["X-RateLimit-Reset"]).toBe("60");
    });
});
