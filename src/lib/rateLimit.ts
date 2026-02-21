/**
 * In-Memory Rate Limiter
 *
 * Sliding-window rate limiter for API routes.
 * Uses in-memory Map — resets on server restart, which is fine
 * for protecting AI/crawl budget during normal operation.
 *
 * For production scale, swap to Upstash Redis rate limiter.
 */

interface RateLimitEntry {
    timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs: number): void {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;

    lastCleanup = now;
    const cutoff = now - windowMs;

    for (const [key, entry] of rateLimitStore) {
        entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
        if (entry.timestamps.length === 0) {
            rateLimitStore.delete(key);
        }
    }
}

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

/**
 * Check if a request is allowed under rate limiting.
 *
 * @param key - Unique identifier (userId, IP, etc.)
 * @param config - Rate limit configuration
 * @returns Whether the request is allowed + metadata
 */
export function checkRateLimit(
    key: string,
    config: RateLimitConfig
): RateLimitResult {
    const now = Date.now();
    const cutoff = now - config.windowMs;

    cleanup(config.windowMs);

    let entry = rateLimitStore.get(key);
    if (!entry) {
        entry = { timestamps: [] };
        rateLimitStore.set(key, entry);
    }

    // Remove timestamps outside the window
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
