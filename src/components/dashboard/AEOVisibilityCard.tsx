"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, TrendingUp, TrendingDown, RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";

/**
 * AEO Visibility Dashboard
 *
 * Shows for each competitor:
 *  - Overall visibility % (last 7 days)
 *  - Per-model breakdown (ChatGPT, Perplexity, Claude, Gemini, Google AI)
 *  - 30-day trend chart
 *  - Manual "Run scan" button
 *
 * Data loaded via /api/aeo/results. Manual scan via /api/aeo/track.
 */

type ModelName = "chatgpt" | "perplexity" | "claude" | "gemini" | "google_ai";

interface VisibilitySummary {
    total: number;
    mentions: number;
    visibility_pct: number;
    avg_position: number | null;
    by_model: Array<{
        model: ModelName;
        total: number;
        mentions: number;
        visibility_pct: number;
        avg_position: number | null;
    }>;
}

interface VisibilityResult {
    competitor: {
        id: string;
        name: string;
        aeo_enabled: boolean;
        queries: string[];
    };
    window_days: number;
    summary: VisibilitySummary;
    history: Array<{
        date: string;
        visibility_pct: number;
        total: number;
        mentions: number;
        by_model: Record<string, { visibility_pct: number; total: number; mentions: number }>;
    }>;
}

interface AEOCompetitorInput {
    id: string;
    name: string;
    url?: string;
    failure_count?: number;
    created_at?: string;
    status?: string;
    last_checked_at?: string | null;
}

const MODEL_LABELS: Record<ModelName, string> = {
    chatgpt: "ChatGPT",
    perplexity: "Perplexity",
    claude: "Claude",
    gemini: "Gemini",
    google_ai: "Google AI",
};

const MODEL_COLORS: Record<ModelName, string> = {
    chatgpt: "from-emerald-500 to-green-500",
    perplexity: "from-blue-500 to-cyan-500",
    claude: "from-purple-500 to-pink-500",
    gemini: "from-amber-500 to-orange-500",
    google_ai: "from-red-500 to-rose-500",
};

export function AEOVisibilityCard({ competitor }: { competitor: AEOCompetitorInput }) {
    const [data, setData] = useState<VisibilityResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchResults = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch(
                `/api/aeo/results?competitorId=${competitor.id}&windowDays=7`
            );
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to load");
            }
            const result = await res.json();
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load");
        } finally {
            setIsLoading(false);
        }
    }, [competitor.id]);

    useEffect(() => {
        fetchResults();
    }, [fetchResults]);

    const runScan = async () => {
        setIsScanning(true);
        try {
            const res = await fetch("/api/aeo/track", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ competitorId: competitor.id }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Scan failed");
            toast.success(
                `Scanned ${result.queries} queries × ${result.models} models. ${result.total_mentions} mentions found.`
            );
            // Refresh
            await fetchResults();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Scan failed");
        } finally {
            setIsScanning(false);
        }
    };

    if (isLoading) {
        return (
            <Card className="glass-card">
                <CardContent className="p-6 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    if (error || !data) {
        return (
            <Card className="glass-card">
                <CardContent className="p-4">
                    <p className="text-sm text-red-400">{error || "No data"}</p>
                    <Button onClick={fetchResults} variant="outline" size="sm" className="mt-2">
                        Retry
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const { summary, history } = data;
    const visibility = summary.visibility_pct;
    const trend = computeTrend(history);
    const hasData = summary.total > 0;

    if (!hasData) {
        return (
            <Card className="glass-card">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <CardTitle className="text-base">AI Visibility</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="text-center py-6">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                        <Sparkles className="w-6 h-6 text-emerald-400" />
                    </div>
                    <p className="text-sm text-foreground font-medium mb-1">
                        No scans yet
                    </p>
                    <p className="text-xs text-muted-foreground max-w-[260px] mx-auto leading-relaxed mb-5">
                        Measure how often ChatGPT, Perplexity, Claude, Gemini and
                        Google AI mention {data.competitor.name} when buyers ask for
                        recommendations.
                    </p>
                    <Button
                        onClick={runScan}
                        disabled={isScanning}
                        variant="glow-emerald"
                        size="sm"
                        className="gap-2"
                    >
                        {isScanning ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Sparkles className="w-4 h-4" />
                        )}
                        {isScanning ? "Scanning…" : "Run your first scan"}
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="glass-card">
            <CardHeader>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                            <CardTitle className="text-base truncate">
                                AI Visibility
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Mentioned in {summary.mentions}/{summary.total} answers
                                in the last {data.window_days} days
                            </CardDescription>
                        </div>
                    </div>
                    <Button
                        onClick={runScan}
                        size="sm"
                        variant="outline"
                        disabled={isScanning}
                        className="gap-1"
                    >
                        {isScanning ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <RefreshCw className="w-3 h-3" />
                        )}
                        <span className="hidden sm:inline">Run scan</span>
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Big number + trend */}
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-display font-bold">
                        {visibility.toFixed(0)}%
                    </span>
                    {trend && (
                        <span
                            className={`text-xs flex items-center gap-1 ${
                                trend.direction === "up"
                                    ? "text-emerald-400"
                                    : "text-red-400"
                            }`}
                        >
                            {trend.direction === "up" ? (
                                <TrendingUp className="w-3 h-3" />
                            ) : (
                                <TrendingDown className="w-3 h-3" />
                            )}
                            {trend.delta > 0 ? "+" : ""}
                            {trend.delta.toFixed(1)}% vs last week
                        </span>
                    )}
                </div>

                {/* Per-model bars */}
                <div className="space-y-2">
                    {summary.by_model.map((m) => (
                        <div key={m.model} className="flex items-center gap-2">
                            <div className="w-24 text-xs text-muted-foreground">
                                {MODEL_LABELS[m.model]}
                            </div>
                            <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                                <div
                                    className={`h-full bg-gradient-to-r ${MODEL_COLORS[m.model]}`}
                                    style={{ width: `${m.visibility_pct}%` }}
                                />
                            </div>
                            <div className="w-12 text-xs text-right font-mono">
                                {m.visibility_pct.toFixed(0)}%
                            </div>
                        </div>
                    ))}
                </div>

                {/* Position badge */}
                {summary.avg_position && (
                    <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                        <span className="text-xs text-muted-foreground">
                            Avg position when mentioned:
                        </span>
                        <Badge variant="outline" className="text-xs">
                            #{summary.avg_position.toFixed(1)}
                        </Badge>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/**
 * Compute week-over-week trend from 30-day daily history.
 * Returns null if not enough data.
 */
function computeTrend(
    history: Array<{ date: string; visibility_pct: number }>
): { direction: "up" | "down"; delta: number } | null {
    if (history.length < 7) return null;

    const recent = history.slice(-7);
    const prior = history.slice(-14, -7);

    if (prior.length === 0) return null;

    const recentAvg =
        recent.reduce((sum, h) => sum + h.visibility_pct, 0) / recent.length;
    const priorAvg =
        prior.reduce((sum, h) => sum + h.visibility_pct, 0) / prior.length;

    const delta = recentAvg - priorAvg;
    if (Math.abs(delta) < 0.1) return null;

    return {
        direction: delta > 0 ? "up" : "down",
        delta,
    };
}
