"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * useRealtimeCompetitors
 *
 * Subscribes to UPDATE events on the `competitors` table filtered by
 * the user's competitor ids. Lets the dashboard flip a card out of its
 * "Running first scan…" state (UX-1) the moment `last_checked_at` is
 * set by the crawl task — no refetch/refresh required.
 *
 * Mirrors useRealtimeAlerts.
 */

interface UseRealtimeCompetitorsOptions {
    competitorIds: string[];
    onUpdate: (competitor: Record<string, unknown>) => void;
    enabled?: boolean;
}

export function useRealtimeCompetitors({
    competitorIds,
    onUpdate,
    enabled = true,
}: UseRealtimeCompetitorsOptions) {
    const channelRef = useRef<RealtimeChannel | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!enabled || competitorIds.length === 0) {
            return;
        }

        const channel = supabase
            .channel("user-competitors-feed")
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "competitors",
                    filter: `id=in.(${competitorIds.join(",")})`,
                },
                (payload) => {
                    if (payload.new && typeof payload.new === "object") {
                        onUpdate(payload.new as Record<string, unknown>);
                    }
                }
            )
            .subscribe((status) => {
                setIsConnected(status === "SUBSCRIBED");
            });

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
            setIsConnected(false);
        };
    }, [competitorIds.join(","), enabled, onUpdate]);

    return { isConnected };
}
