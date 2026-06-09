"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { PricingTrendChart } from "@/components/charts";
import type { Competitor } from "@/hooks/useDashboardData";

/**
 * PricingHistoryDialog
 *
 * Self-contained. Fetches `/api/competitors/[id]/history` on open,
 * derives chart points (min price per day), and renders the
 * PricingTrendChart.
 *
 * Free plan: shows a soft paywall prompt instead of the chart.
 */

interface Props {
    competitor: Competitor | null;
    userPlan: "free" | "pro" | "enterprise";
    onClose: () => void;
    onUpgrade: () => void;
}

interface HistoryPoint {
    date: string;
    price: number;
}

export function PricingHistoryDialog({ competitor, userPlan, onClose, onUpgrade }: Props) {
    const [isLoading, setIsLoading] = useState(false);
    const [chartData, setChartData] = useState<HistoryPoint[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!competitor) {
            setChartData([]);
            return;
        }

        if (userPlan === "free") return;

        setIsLoading(true);
        setError(null);
        fetch(`/api/competitors/${competitor.id}/history`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to load history");
                const data = await res.json();
                const points: HistoryPoint[] = (data.history || [])
                    .map((h: { date: string; plans?: { price_raw?: string | null }[] }) => {
                        const prices = (h.plans || [])
                            .map((p) => parseFloat(p.price_raw?.replace(/[^0-9.]/g, "") || "0"))
                            .filter((v: number) => v > 0);
                        const minPrice = prices.length ? Math.min(...prices) : 0;
                        return { date: h.date, price: minPrice };
                    })
                    .filter((p: HistoryPoint) => p.price > 0);
                setChartData(points);
            })
            .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
            .finally(() => setIsLoading(false));
    }, [competitor, userPlan]);

    if (!competitor) return null;

    return (
        <Dialog open={!!competitor} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="font-display text-xl">
                        {competitor.name} — Pricing History
                    </DialogTitle>
                    <DialogDescription>
                        Lowest visible plan price over time.
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-4 min-h-[300px] flex items-center justify-center">
                    {isLoading ? (
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                    ) : error ? (
                        <p className="text-sm text-red-400" role="alert">{error}</p>
                    ) : userPlan === "free" ? (
                        <div className="text-center space-y-3 py-8">
                            <p className="text-foreground">Pricing history is a Pro feature.</p>
                            <button
                                onClick={onUpgrade}
                                className="text-emerald-400 hover:underline text-sm"
                            >
                                Upgrade to Pro →
                            </button>
                        </div>
                    ) : chartData.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No history yet — we need at least 2 snapshots.
                        </p>
                    ) : (
                        <PricingTrendChart data={chartData} />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
