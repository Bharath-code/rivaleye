"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * useSWRCache — Stale-While-Revalidate data fetching hook.
 *
 * Returns cached data instantly on mount, then revalidates in background.
 * Cache is keyed by URL and stored in a module-level Map (persists across re-renders).
 */

interface SWRResult<T> {
    data: T | null;
    error: string | null;
    isLoading: boolean;
    isValidating: boolean;
    mutate: () => Promise<void>;
}

// Module-level cache — persists across component remounts
const cache = new Map<string, { data: unknown; timestamp: number }>();

const DEFAULT_STALE_TIME = 30_000; // 30 seconds

export function useSWRCache<T>(
    url: string,
    options?: {
        staleTime?: number;
        transform?: (raw: unknown) => T;
        enabled?: boolean;
    }
): SWRResult<T> {
    const staleTime = options?.staleTime ?? DEFAULT_STALE_TIME;
    const enabled = options?.enabled ?? true;

    const [data, setData] = useState<T | null>(() => {
        const cached = cache.get(url);
        if (cached) {
            return (options?.transform ? options.transform(cached.data) : cached.data) as T;
        }
        return null;
    });
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(!cache.has(url));
    const [isValidating, setIsValidating] = useState(false);
    const mountedRef = useRef(true);

    const revalidate = useCallback(async () => {
        if (!enabled) return;
        setIsValidating(true);

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Failed to fetch ${url}`);

            const raw = await res.json();
            const transformed = options?.transform ? options.transform(raw) : raw;

            cache.set(url, { data: raw, timestamp: Date.now() });

            if (mountedRef.current) {
                setData(transformed as T);
                setError(null);
            }
        } catch (err) {
            if (mountedRef.current) {
                setError(err instanceof Error ? err.message : "Fetch failed");
            }
        } finally {
            if (mountedRef.current) {
                setIsLoading(false);
                setIsValidating(false);
            }
        }
    }, [url, enabled, options?.transform]);

    useEffect(() => {
        mountedRef.current = true;

        const cached = cache.get(url);
        const isStale = !cached || Date.now() - cached.timestamp > staleTime;

        if (isStale) {
            revalidate();
        } else {
            setIsLoading(false);
        }

        return () => {
            mountedRef.current = false;
        };
    }, [url, staleTime, revalidate]);

    return {
        data,
        error,
        isLoading,
        isValidating,
        mutate: revalidate,
    };
}
