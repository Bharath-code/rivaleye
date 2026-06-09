"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { analytics } from "@/components/providers/AnalyticsProvider";
import { useRealtimeAlerts } from "@/hooks/useRealtimeAlerts";

/**
 * useDashboardData — Centralized data hook for the dashboard.
 *
 * Owns:
 * - competitors list
 * - alerts list
 * - user plan
 * - market radar data (Pro only)
 * - loading + error state
 *
 * Owns the initial load and refetch logic. Replaces ~50 lines of
 * useState/useEffect/useCallback soup from the page component.
 */

export interface Competitor {
    id: string;
    name: string;
    url: string;
    status: "active" | "paused" | "error";
    last_checked_at: string | null;
    failure_count: number;
    created_at: string;
}

export interface DashboardAlert {
    id: string;
    competitor_id: string;
    diff_summary: string;
    ai_insight: string;
    is_meaningful: boolean;
    is_read?: boolean;
    type?: string;
    severity?: string;
    title?: string;
    description?: string;
    details?: {
        context?: string;
        before?: string | null;
        after?: string | null;
        aiExplanation?: string;
    };
    created_at: string;
    competitors?: { name: string };
}

export interface MarketRadarPoint {
    id: string;
    name: string;
    featureDensity: number;
    startingPrice: number;
    hasFreeTier: boolean;
}

export interface DashboardData {
    competitors: Competitor[];
    alerts: DashboardAlert[];
    radarData: MarketRadarPoint[];
    userPlan: "free" | "pro" | "enterprise";
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    showOnboarding: boolean;
    dismissOnboarding: () => void;
    shouldShowFirstAlertCelebration: boolean;
}

export function useDashboardData(): DashboardData {
    const router = useRouter();
    const [competitors, setCompetitors] = useState<Competitor[]>([]);
    const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
    const [userPlan, setUserPlan] = useState<"free" | "pro" | "enterprise">("free");
    const [radarData, setRadarData] = useState<MarketRadarPoint[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const onboardingDismissed = useRef(false);

    const fetchData = useCallback(async () => {
        try {
            const [competitorsRes, alertsRes] = await Promise.all([
                fetch("/api/competitors"),
                fetch("/api/alerts"),
            ]);

            if (competitorsRes.status === 401 || alertsRes.status === 401) {
                router.push("/login");
                return;
            }

            if (!competitorsRes.ok || !alertsRes.ok) {
                throw new Error("Failed to fetch data");
            }

            const competitorsData = await competitorsRes.json();
            const alertsData = await alertsRes.json();

            setCompetitors(competitorsData.competitors || []);
            setUserPlan(competitorsData.plan || "free");
            setAlerts(alertsData.alerts || []);

            // Show onboarding only on first load with no competitors
            if (
                !onboardingDismissed.current &&
                (competitorsData.competitors || []).length === 0
            ) {
                setShowOnboarding(true);
            }

            // Market Radar (Pro Only)
            if (competitorsData.plan !== "free") {
                const radarRes = await fetch("/api/market-radar");
                if (radarRes.ok) {
                    const radarJson = await radarRes.json();
                    setRadarData(radarJson.data || []);
                }
            } else {
                setRadarData([]);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load data");
        } finally {
            setIsLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchData();

        // Track dashboard visit
        if (typeof window !== "undefined") {
            const userCreatedAt = localStorage.getItem("userCreatedAt");
            if (userCreatedAt) {
                const daysSinceSignup = Math.floor(
                    (Date.now() - new Date(userCreatedAt).getTime()) / (1000 * 60 * 60 * 24)
                );
                analytics.dashboardVisit(daysSinceSignup);
            } else {
                analytics.dashboardVisit(0);
            }
        }
    }, [fetchData]);

    const dismissOnboarding = useCallback(() => {
        onboardingDismissed.current = true;
        setShowOnboarding(false);
    }, []);

    // First-alert celebration: triggers when alert count is exactly 1
    // and the user hasn't seen the modal yet (localStorage flag).
    const shouldShowFirstAlertCelebration = (() => {
        if (alerts.length !== 1 || isLoading) return false;
        if (typeof window === "undefined") return false;
        try {
            return !localStorage.getItem("rivaleye:first-alert-celebrated");
        } catch {
            return false;
        }
    })();

    // Real-time: when a new alert is inserted (by the daily trigger
    // job or a manual analysis), prepend it to the list without a refetch.
    useRealtimeAlerts({
        competitorIds: competitors.map((c) => c.id),
        enabled: !isLoading && competitors.length > 0,
        onNewAlert: useCallback(
            (newAlert: Record<string, unknown>) => {
                setAlerts((prev) => {
                    // De-dupe by id in case of duplicate events
                    if (prev.some((a) => a.id === newAlert.id)) return prev;
                    // Cast through unknown — payload shape is loosely typed
                    return [newAlert as unknown as DashboardAlert, ...prev].slice(0, 50);
                });
            },
            []
        ),
    });

    return {
        competitors,
        alerts,
        radarData,
        userPlan,
        isLoading,
        error,
        refetch: fetchData,
        showOnboarding,
        dismissOnboarding,
        shouldShowFirstAlertCelebration,
    };
}
