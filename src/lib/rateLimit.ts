import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

/**
 * Distributed Rate Limiter (SEC-5)
 *
 * Sliding-window rate limiter for API routes.
 *
 * - When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, state lives
 *   in Upstash Redis and the limit is enforced ATOMICALLY (Lua-backed sliding
 *   window via @upstash/ratelimit) consistently across all serverless
 *   instances. Atomicity matters: a naive read-count-then-write has a race
 *   where concurrent requests all pass the check before any increments.
 * - Otherwise it falls back to an in-memory Map (per-instance, best-effort) —
 *   fine for local dev, but NOT effective on serverless. Set the env vars in
 *   production.
 *
 * `checkRateLimit` is async (Redis is a network call). The in-memory path
 * resolves synchronously under the hood.
 */

export interface RateLimitConfig {
    /** Max requests allowed in the window */
    maxRequests: number;
    /** Window duration in milliseconds */
    windowMs: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetMs: number;
}

// ══════════════════════════════════════════════════════════════════════════════
// REDIS CLIENT (lazy, optional)
// ══════════════════════════════════════════════════════════════════════════════

let redis: Redis | null = null;
let redisChecked = false;

function getRedis(): Redis | null {
    if (redisChecked) return redis;
    redisChecked = true;

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (url && token) {
        redis = new Redis({ url, token });
    } else if (process.env.NODE_ENV === "production") {
        console.warn(
            "Upstash Redis env not set — rate limiting falls back to in-memory " +
            "(per-instance, ineffective on serverless). Set UPSTASH_REDIS_REST_URL " +
            "and UPSTASH_REDIS_REST_TOKEN."
        );
    }
    return redis;
}

// ══════════════════════════════════════════════════════════════════════════════
// IN-MEMORY FALLBACK
// ══════════════════════════════════════════════════════════════════════════════

interface RateLimitEntry {
    timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs: number): void {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    lastCleanup = now;
    const cutoff = now - windowMs;
    for (const [key, entry] of rateLimitStore) {
        entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
        if (entry.timestamps.length === 0) rateLimitStore.delete(key);
    }
}

function checkInMemory(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const cutoff = now - config.windowMs;
    cleanup(config.windowMs);

    let entry = rateLimitStore.get(key);
    if (!entry) {
        entry = { timestamps: [] };
        rateLimitStore.set(key, entry);
    }
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    if (entry.timestamps.length >= config.maxRequests) {
        const oldestInWindow = entry.timestamps[0];
        return {
            allowed: false,
            remaining: 0,
            resetMs: oldestInWindow + config.windowMs - now,
        };
    }

    entry.timestamps.push(now);
    return {
        allowed: true,
        remaining: config.maxRequests - entry.timestamps.length,
        resetMs: config.windowMs,
    };
}

// ══════════════════════════════════════════════════════════════════════════════
// REDIS SLIDING WINDOW (atomic, via @upstash/ratelimit)
// ══════════════════════════════════════════════════════════════════════════════

// One Ratelimit instance per distinct (maxRequests, windowMs) config, sharing
// the single Redis client. Cached so we don't rebuild the Lua script each call.
const limiterCache = new Map<string, Ratelimit>();

function limiterFor(client: Redis, config: RateLimitConfig): Ratelimit {
    const cacheKey = `${config.maxRequests}:${config.windowMs}`;
    let limiter = limiterCache.get(cacheKey);
    if (!limiter) {
        limiter = new Ratelimit({
            redis: client,
            limiter: Ratelimit.slidingWindow(
                config.maxRequests,
                `${config.windowMs} ms`
            ),
            prefix: "rl",
            analytics: false,
        });
        limiterCache.set(cacheKey, limiter);
    }
    return limiter;
}

async function checkRedis(
    client: Redis,
    key: string,
    config: RateLimitConfig
): Promise<RateLimitResult> {
    const { success, remaining, reset } = await limiterFor(client, config).limit(key);
    return {
        allowed: success,
        remaining: Math.max(remaining, 0),
        resetMs: Math.max(reset - Date.now(), 0),
    };
}

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a request is allowed under rate limiting.
 *
 * @param key - Unique identifier (userId, IP, etc.)
 * @param config - Rate limit configuration
 */
export async function checkRateLimit(
    key: string,
    config: RateLimitConfig
): Promise<RateLimitResult> {
    const client = getRedis();
    if (!client) return checkInMemory(key, config);

    try {
        return await checkRedis(client, key, config);
    } catch (err) {
        // Never let a limiter outage take down the route — fail open to the
        // in-memory limiter rather than 500ing.
        console.error("Redis rate limit error, falling back to in-memory:", err);
        return checkInMemory(key, config);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// PRE-CONFIGURED LIMITERS
// ══════════════════════════════════════════════════════════════════════════════

/** Expensive operations: AI analysis, vision scans */
export const RATE_LIMITS = {
    /** AI analysis: 10 requests per 15 minutes per user */
    analysis: { maxRequests: 10, windowMs: 15 * 60 * 1000 } as RateLimitConfig,

    /** Manual checks: 20 per hour per user */
    manualCheck: { maxRequests: 20, windowMs: 60 * 60 * 1000 } as RateLimitConfig,

    /** Competitor CRUD: 30 per minute per user */
    competitors: { maxRequests: 30, windowMs: 60 * 1000 } as RateLimitConfig,

    /** General API: 100 per minute per user */
    general: { maxRequests: 100, windowMs: 60 * 1000 } as RateLimitConfig,

    /** Auth endpoints: 10 per minute per IP */
    auth: { maxRequests: 10, windowMs: 60 * 1000 } as RateLimitConfig,
} as const;

/**
 * Generate standard rate limit response headers from a result.
 * Spread into NextResponse headers: `{ headers: rateLimitHeaders(result, config) }`
 */
export function rateLimitHeaders(
    result: RateLimitResult,
    config: RateLimitConfig
): Record<string, string> {
    return {
        "X-RateLimit-Limit": String(config.maxRequests),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(Math.ceil(result.resetMs / 1000)),
    };
}
