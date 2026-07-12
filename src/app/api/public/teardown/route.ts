import { NextRequest, NextResponse } from "next/server";
import { validateCompetitorUrl } from "@/lib/urlValidator";
import { checkRateLimit, RATE_LIMITS, rateLimitHeaders } from "@/lib/rateLimit";
import { parseBody, teardownSchema } from "@/lib/validation/schemas";
import { scrapePricing } from "@/lib/crawler/scrapePage";

/**
 * POST /api/public/teardown
 *
 * P5 — instant teardown: paste a competitor URL, pre-signup, and get back
 * their pricing plans + a live screenshot in one synchronous Firecrawl call.
 * No auth — this IS the activation moment, gated by a per-IP rate limit
 * instead (each call costs a Firecrawl credit).
 *
 * ponytail: no bot challenge (Turnstile) in front of this yet, relying on the
 * per-IP limit alone — add Turnstile if abuse shows up in Firecrawl usage.
 */
export async function POST(request: NextRequest) {
    // Vercel's edge sets x-forwarded-for itself (not client-controllable there);
    // self-hosted deployments in front of a different proxy must guarantee the
    // same or this key collapses to a shared bucket.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || request.headers.get("x-real-ip")
        || "unknown";
    if (ip === "unknown") console.warn("[Teardown] request with no client IP header");

    const rateCheck = await checkRateLimit(`teardown:${ip}`, RATE_LIMITS.teardown);
    if (!rateCheck.allowed) {
        return NextResponse.json(
            { error: "Too many teardown requests. Please wait a few minutes." },
            {
                status: 429,
                headers: {
                    "Retry-After": String(Math.ceil(rateCheck.resetMs / 1000)),
                    ...rateLimitHeaders(rateCheck, RATE_LIMITS.teardown),
                },
            }
        );
    }

    const parsed = await parseBody(request, teardownSchema);
    if (parsed.error) return parsed.error;

    const validation = validateCompetitorUrl(parsed.data.url);
    if (!validation.valid || !validation.sanitizedUrl) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const result = await scrapePricing(validation.sanitizedUrl, undefined, false, true);

    if (!result.success) {
        console.error(`[Teardown] scrape failed for ${validation.sanitizedUrl}: [${result.code}] ${result.error}`);
        const status = result.code === "NO_PRICING" ? 422 : 502;
        const message = result.code === "NO_PRICING" ? result.error : "Couldn't read that page. Try a different URL.";
        return NextResponse.json({ error: message, code: result.code }, { status });
    }

    return NextResponse.json({
        success: true,
        url: validation.sanitizedUrl,
        pricing: result.pricingSchema,
        screenshotUrl: result.screenshotUrl || null,
    });
}
