"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, type ReactNode } from "react";

/**
 * TanStack Query Provider
 *
 * Centralized server-state cache. Replaces the dashboard's
 * useState + useEffect + Promise.all fetch soup with declarative
 * useQuery() calls. Provides:
 * - Automatic background refetch
 * - Optimistic updates
 * - Cache deduplication
 * - Stale-while-revalidate
 *
 * Defaults:
 * - staleTime: 30s (don't refetch within 30s of mount)
 * - gcTime: 5min (keep in cache after unmount)
 * - refetchOnWindowFocus: true (refresh on tab focus)
 * - retry: 1 (single retry on failure; production handles retry in route)
 */

export function QueryProvider({ children }: { children: ReactNode }) {
    const [client] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 30 * 1000,
                        gcTime: 5 * 60 * 1000,
                        refetchOnWindowFocus: true,
                        retry: 1,
                    },
                    mutations: {
                        retry: 0,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={client}>
            {children}
            {process.env.NODE_ENV === "development" && (
                <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
            )}
        </QueryClientProvider>
    );
}
