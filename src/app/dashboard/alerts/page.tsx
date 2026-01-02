"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertList } from "@/components/alerts";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import { Loader2 } from "lucide-react";
import type { PricingDiffType, AlertSeverity } from "@/lib/types";

/**
 * Full Alerts Page
 * 
 * Dedicated page for viewing and managing all pricing alerts.
 */

interface AlertData {
    id: string;
    competitor_id: string;
    competitor_name: string;
    type: PricingDiffType;
    severity: AlertSeverity;
    title: string;
    description: string;
    details: {
        context?: string;
        before?: string | null;
        after?: string | null;
        aiExplanation?: string;
    };
    is_read: boolean;
    created_at: string;
}

export default function AlertsPage() {
    const router = useRouter();
    const [alerts, setAlerts] = useState<AlertData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAlerts = useCallback(async () => {
        try {
            const res = await fetch("/api/alerts");

            if (res.status === 401) {
                router.push("/login");
                return;
            }

            if (!res.ok) {
                throw new Error("Failed to fetch alerts");
            }

            const data = await res.json();

            // Transform the data to match AlertData interface
            const transformedAlerts: AlertData[] = (data.alerts || []).map((alert: {
                id: string;
                competitor_id: string;
                type?: PricingDiffType;
                severity?: AlertSeverity;
                title?: string;
                description?: string;
                details?: {
                    context?: string;
                    before?: string | null;
                    after?: string | null;
                    aiExplanation?: string;
                };
                is_read?: boolean;
                created_at: string;
                diff_summary?: string;
                ai_insight?: string;
                competitors?: { name: string };
            }) => {
                // Parse ai_insight if it's JSON
                let details = alert.details || {};
                if (alert.ai_insight && !alert.details?.aiExplanation) {
                    try {
                        const parsed = JSON.parse(alert.ai_insight);
                        details = {
                            ...details,
                            aiExplanation: parsed.whyItMatters || parsed.whatChanged,
                        };
                    } catch {
                        details = {
                            ...details,
                            aiExplanation: alert.ai_insight,
                        };
                    }
                }

                return {
                    id: alert.id,
                    competitor_id: alert.competitor_id,
                    competitor_name: alert.competitors?.name || "Unknown",
                    type: alert.type || "price_increase",
                    severity: alert.severity || "medium",
                    title: alert.title || alert.diff_summary || "Pricing Change Detected",
                    description: alert.description || alert.diff_summary || "",
                    details,
                    is_read: alert.is_read ?? false,
                    created_at: alert.created_at,
                };
            });

            setAlerts(transformedAlerts);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load alerts");
        } finally {
            setIsLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchAlerts();
    }, [fetchAlerts]);

    const handleViewDetails = (id: string) => {
        router.push(`/dashboard/alerts/${id}`);
    };

    const handleDismiss = async (id: string) => {
        try {
            await fetch(`/api/alerts/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_read: true }),
            });

            setAlerts((prev) =>
                prev.map((a) => (a.id === id ? { ...a, is_read: true } : a))
            );
        } catch (err) {
            console.error("Failed to dismiss alert:", err);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await fetch("/api/alerts/mark-all-read", { method: "POST" });
            setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
        } catch (err) {
            console.error("Failed to mark all as read:", err);
        }
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </main>
                <Footer />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-red-500 mb-4">{error}</p>
                        <button
                            onClick={() => fetchAlerts()}
                            className="text-primary underline"
                        >
                            Try Again
                        </button>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-screen">
            <Header />

            <main className="flex-1 pt-24 pb-12 px-6">
                <div className="max-w-4xl mx-auto">
                    <AlertList
                        alerts={alerts}
                        onViewDetails={handleViewDetails}
                        onDismiss={handleDismiss}
                        onMarkAllRead={handleMarkAllRead}
                    />
                </div>
            </main>

            <Footer />
        </div>
    );
}
