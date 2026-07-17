import { NextRequest, NextResponse } from "next/server";
import { validateCompetitorUrl } from "@/lib/urlValidator";
import { checkRateLimit, RATE_LIMITS, rateLimitHeaders } from "@/lib/rateLimit";
import { parseBody, aeoCheckSchema } from "@/lib/validation/schemas";
import { queryModel, type ModelName } from "@/lib/aeo/providers";
import { isBrandMentioned } from "@/lib/aeo/parser";
import { generateDefaultQueries } from "@/lib/aeo/queries";
import { createServerClient } from "@/lib/supabase";

/**
 * POST /api/public/aeo-check
 *
 * Free pre-signup "am I visible in AI answers?" checker — the AEO wedge's
 * activation moment, mirroring /api/public/teardown. No auth; abuse is gated
 * by a strict per-IP limit (3/day) + a 24h per-(domain,brand) result cache,
 * and each uncached run is hard-capped at 3 queries × 2 cheapest models.
 */
const CHECK_MODELS: ModelName[] = ["gemini", "chatgpt"];
const CHECK_QUERY_COUNT = 3;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
    // ponytail: per-IP rate limiting keyed off x-forwarded-for is spoofable by
    // any client that controls its own request headers (or sits behind a proxy
    // that doesn't overwrite them) — same known, accepted limitation as
    // /api/public/teardown, and covered by the project's tracked SEC-5
    // (in-memory rate limiter, best-effort until moved to Redis/Upstash). Not a
    // new gap introduced here; not fixing it in this route either.
    const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";

    const rateCheck = await checkRateLimit(`aeo-check:${ip}`, RATE_LIMITS.aeoCheck);
    if (!rateCheck.allowed) {
        return NextResponse.json(
            { error: "Free check limit reached — sign up for daily tracking." },
            {
                status: 429,
                headers: {
                    "Retry-After": String(Math.ceil(rateCheck.resetMs / 1000)),
                    ...rateLimitHeaders(rateCheck, RATE_LIMITS.aeoCheck),
                },
            }
        );
    }

    const parsed = await parseBody(request, aeoCheckSchema);
    if (parsed.error) return parsed.error;

    const validation = validateCompetitorUrl(parsed.data.url);
    if (!validation.valid || !validation.sanitizedUrl) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const brand = parsed.data.brand;
    const hostname = new URL(validation.sanitizedUrl).hostname.replace(/^www\./, "");
    const cacheKey = `${hostname}::${brand.toLowerCase()}`;
    const supabase = createServerClient();

    const { data: cached } = await supabase
        .from("public_aeo_checks")
        .select("result, created_at")
        .eq("cache_key", cacheKey)
        .gte("created_at", new Date(Date.now() - CACHE_TTL_MS).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (cached?.result) {
        return NextResponse.json({ ...cached.result, cached: true });
    }

    const queries = generateDefaultQueries({
        name: brand,
        url: validation.sanitizedUrl,
    }).slice(0, CHECK_QUERY_COUNT);

    const tasks = queries.flatMap((query) =>
        CHECK_MODELS.map((model) => ({ model, query }))
    );

    const settled = await Promise.allSettled(
        tasks.map(({ model, query }) =>
            queryModel(model, { prompt: query, competitorName: brand })
        )
    );

    let mentions = 0;
    let answered = 0;
    const results: Array<{
        model: ModelName;
        query: string;
        mentioned: boolean;
        excerpt: string | null;
    }> = [];

    for (let i = 0; i < tasks.length; i++) {
        const s = settled[i];
        if (s.status !== "fulfilled" || !s.value) continue;
        answered++;
        const check = isBrandMentioned(
            s.value.response_text,
            s.value.citations,
            brand,
            validation.sanitizedUrl
        );
        if (check.mentioned) mentions++;
        results.push({
            model: tasks[i].model,
            query: tasks[i].query,
            mentioned: check.mentioned,
            excerpt: check.excerpt,
        });
    }

    if (answered === 0) {
        console.error(`[AEOCheck] all model calls failed for ${cacheKey}`);
        return NextResponse.json(
            { error: "AI models are busy right now. Try again in a minute." },
            { status: 502 }
        );
    }

    const result = {
        brand,
        url: validation.sanitizedUrl,
        total: answered,
        mentions,
        visibility_pct: Math.round((mentions / answered) * 1000) / 10,
        results,
    };

    const { error: cacheError } = await supabase
        .from("public_aeo_checks")
        .insert({ cache_key: cacheKey, result });
    if (cacheError) console.error("[AEOCheck] cache insert failed:", cacheError.message);

    return NextResponse.json({ ...result, cached: false });
}
