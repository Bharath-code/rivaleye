"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * useRealtimeAlerts
 *
 * Subscribes to INSERT events on the `alerts` table filtered by
 * the user's competitors. New alerts appear in the UI without a refresh.
 *
 * Falls back gracefully: if Realtime isn't enabled on the Supabase
 * project, returns an empty subscription. The poll-based fetch is
 * unchanged — Realtime is purely additive.
 *
 * Usage:
 *   useRealtimeAlerts({
 *     competitorIds: data.competitors.map(c => c.id),
 *     onNewAlert: (alert) => setAlerts(prev => [alert, ...prev]),
 *   });
 */

interface UseRealtimeAlertsOptions {
    competitorIds: string[];
    onNewAlert: (alert: Record<string, unknown>) => void;
    enabled?: boolean;
}

export function useRealtimeAlerts({
    competitorIds,
    onNewAlert,
    enabled = true,
}: UseRealtimeAlertsOptions) {
    const channelRef = useRef<RealtimeChannel | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!enabled || competitorIds.length === 0) {
            return;
        }

        // Subscribe to new alerts on this user's competitors
        // Supabase Realtime uses Postgres LISTEN/NATIVE — when the
        // trigger.dev task inserts a new alert, this fires in <100ms.
        const channel = supabase
            .channel("user-alerts-feed")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "alerts",
                    filter: `competitor_id=in.(${competitorIds.join(",")})`,
                },
                (payload) => {
                    // payload.new is the new alert row
                    if (payload.new && typeof payload.new === "object") {
                        onNewAlert(payload.new as Record<string, unknown>);
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
    }, [competitorIds.join(","), enabled, onNewAlert]);

    return { isConnected };
}
