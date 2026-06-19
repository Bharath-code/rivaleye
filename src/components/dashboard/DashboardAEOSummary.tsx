"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Radar } from "lucide-react";
import type { AggregateVisibility } from "@/lib/aeo/aggregateVisibility";

/**
 * Dashboard "AI Visibility" panel.
 *
 * Surfaces the AEO wedge at the top level: blended visibility across all
 * AEO-enabled competitors, with a per-competitor breakdown that links into
 * each competitor's detail view for the full per-model report.
 *
 * Self-fetches from /api/aeo/summary so it never blocks the dashboard's
 * initial render (competitors/alerts load independently).
 */

type Summary = AggregateVisibility & { window_days: number };

export function DashboardAEOSummary() {
    const [data, setData] = useState<Summary | null>(null);
    const [state, setState] = useState<"loading" | "ready" | "error">("loading");

    const load = useCallback(async () => {
        setState("loading");
        try {
            const res = await fetch("/api/aeo/summary?windowDays=7");
            if (!res.ok) throw new Error();
            setData(await res.json());
            setState("ready");
        } catch {
            setState("error");
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    if (state === "loading") {
        return (
            <Card className="glass-card">
                <CardContent className="p-5">
                    <div
                        className="h-24 animate-pulse rounded-lg bg-white/[0.03]"
                        aria-busy="true"
                        aria-label="Loading AI visibility"
                    />
                </CardContent>
            </Card>
        );
    }

    // Fail quietly — AEO is supplementary; don't break the dashboard.
    if (state === "error" || !data) return null;

    return (
        <Card className="glass-card overflow-hidden">
            <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <h2 className="font-display text-lg">AI Visibility</h2>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                        AEO
                    </span>
                    <span className="ml-auto text-[11px] text-muted-foreground font-mono">
                        last {data.window_days}d
                    </span>
                </div>

                {data.tracked === 0 ? (
                    <EmptyTracked />
                ) : data.scanned === 0 ? (
                    <EmptyScanned tracked={data.tracked} />
                ) : (
                    <Populated data={data} />
                )}
            </CardContent>
        </Card>
    );
}

function EmptyTracked() {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Radar className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="flex-1">
                <p className="text-sm text-foreground font-medium">
                    See who AI assistants recommend
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-md leading-relaxed">
                    Track whether ChatGPT, Perplexity, Claude, Gemini and Google AI
                    mention your competitors. Enable AEO on a competitor to start.
                </p>
            </div>
        </div>
    );
}

function EmptyScanned({ tracked }: { tracked: number }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="flex-1">
                <p className="text-sm text-foreground font-medium">
                    {tracked} competitor{tracked === 1 ? "" : "s"} ready for AI visibility tracking
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-md leading-relaxed">
                    Open a competitor and press <span className="font-medium text-foreground">Run scan</span>{" "}
                    to measure how often AI assistants recommend them.
                </p>
            </div>
        </div>
    );
}

function Populated({ data }: { data: Summary }) {
    const scanned = data.competitors.filter((c) => c.scanned);
    return (
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-center">
            <div className="md:pr-6 md:border-r border-white/5">
                <div className="text-4xl font-display font-bold text-foreground leading-none">
                    {data.visibility_pct.toFixed(0)}%
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed max-w-[180px]">
                    blended visibility across {scanned.length} scanned competitor
                    {scanned.length === 1 ? "" : "s"}
                </p>
            </div>

            <div className="space-y-2 min-w-0">
                {data.competitors.slice(0, 5).map((c) => (
                    <Link
                        key={c.id}
                        href={`/dashboard/competitors/${c.id}`}
                        className="group flex items-center gap-3 rounded-md px-1 py-0.5 -mx-1 hover:bg-white/[0.03] focus-visible:bg-white/[0.03] transition-colors"
                    >
                        <div className="w-28 text-xs text-muted-foreground truncate group-hover:text-foreground transition-colors">
                            {c.name}
                        </div>
                        <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-green-400"
                                style={{ width: `${c.scanned ? c.visibility_pct : 0}%` }}
                            />
                        </div>
                        <div className="w-10 text-xs text-right font-mono text-foreground">
                            {c.scanned ? `${c.visibility_pct.toFixed(0)}%` : "—"}
                        </div>
                        <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                ))}
            </div>
        </div>
    );
}
