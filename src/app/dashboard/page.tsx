"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw, Sparkles, AlertTriangle, History } from "lucide-react";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { DashboardAlertSummary } from "@/components/alerts";
import { OnboardingWizard } from "@/components/onboarding";
import type { PricingDiffType, AlertSeverity } from "@/lib/types";
import { MarketRadar } from "@/components/charts";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
    CompetitorCard,
    AnalysisResultModal,
    DeleteCompetitorDialog,
    DashboardSkeleton,
} from "@/components/dashboard";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useDashboardData, type Competitor } from "@/hooks/useDashboardData";
import { AddCompetitorDialog } from "./AddCompetitorDialog";
import { EditCompetitorDialog } from "./EditCompetitorDialog";
import { PricingHistoryDialog } from "./PricingHistoryDialog";
import { FirstAlertCelebration } from "@/components/alerts/FirstAlertCelebration";
import type { AnalysisResult } from "@/components/dashboard/AnalysisResultModal";

/**
 * Dashboard Page
 *
 * After T2.1 refactor: this file is the orchestrator only.
 * - Data fetching: useDashboardData() hook
 * - Add dialog: ./AddCompetitorDialog
 * - Edit dialog: ./EditCompetitorDialog
 * - History dialog: ./PricingHistoryDialog
 * - Analysis modal + Delete dialog: still in @/components/dashboard (already extracted)
 *
 * Page-level state is reduced to: which dialogs are open, which
 * competitor is being acted on, and the analysis result.
 */

export default function Dashboard() {
    const router = useRouter();
    const data = useDashboardData();

    // Local UI state (which dialog, which competitor)
    const [deletingCompetitor, setDeletingCompetitor] = useState<Competitor | null>(null);
    const [editingCompetitor, setEditingCompetitor] = useState<Competitor | null>(null);
    const [historyCompetitor, setHistoryCompetitor] = useState<Competitor | null>(null);
    const [analyzingId, setAnalyzingId] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [checkSuccess, setCheckSuccess] = useState<string | null>(null);
    const [isForcedAddOpen, setIsForcedAddOpen] = useState(false);
    const [showCelebration, setShowCelebration] = useState(false);

    // Keyboard shortcuts: N = add competitor, R = refresh
    const shortcuts = useMemo(() => ({
        n: () => setIsForcedAddOpen(true),
        r: () => data.refetch(),
    }), [data]);
    useKeyboardShortcuts(shortcuts);

    // First-visit shortcut onboarding toast
    useEffect(() => {
        if (typeof window === "undefined") return;
        const key = "rivaleye:shortcuts-shown";
        if (!localStorage.getItem(key)) {
            localStorage.setItem(key, "1");
            setTimeout(() => {
                toast("Pro tip", {
                    description: "Press N to add a competitor, R to refresh data",
                    duration: 6000,
                });
            }, 2000);
        }
    }, []);

    // Trigger first-alert celebration when conditions are met
    useEffect(() => {
        if (data.shouldShowFirstAlertCelebration && !showCelebration) {
            setShowCelebration(true);
        }
    }, [data.shouldShowFirstAlertCelebration, showCelebration]);

    // ── Handlers ──
    const handleAdded = useCallback((c: Competitor) => {
        data.refetch();
    }, [data]);

    const handleAnalyze = useCallback(async (competitorId: string) => {
        setAnalyzingId(competitorId);
        setAnalysisResult(null);

        try {
            const res = await fetch("/api/analyze-competitor", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ competitorId }),
            });

            const result = await res.json();

            if (!res.ok) {
                toast.error(result.error || "Analysis failed");
                return;
            }

            setAnalysisResult(result.analysis);

            const competitor = data.competitors.find((c) => c.id === competitorId);
            const changeMsg = result.hasChanged
                ? "🔴 Changes detected!"
                : "✓ No changes since last analysis";
            setCheckSuccess(`${changeMsg} ${competitor?.name || "Page"} analyzed.`);
            setTimeout(() => setCheckSuccess(null), 5000);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Analysis failed");
        } finally {
            setAnalyzingId(null);
        }
    }, [data.competitors]);

    const handleViewHistory = useCallback((comp: Competitor) => {
        if (data.userPlan === "free") {
            window.open("/#pricing", "_blank");
            return;
        }
        setHistoryCompetitor(comp);
    }, [data.userPlan]);

    const handleEdit = useCallback((comp: Competitor) => {
        setEditingCompetitor(comp);
    }, []);

    const handleEditSaved = useCallback((updated: Competitor, historyReset: boolean) => {
        const message = historyReset
            ? `✓ ${updated.name} updated. Historical data has been reset.`
            : `✓ ${updated.name} updated successfully.`;
        setCheckSuccess(message);
        setTimeout(() => setCheckSuccess(null), 5000);
        data.refetch();
    }, [data]);

    const handleDeleteComplete = useCallback((_id: string) => {
        data.refetch();
    }, [data]);

    // ── Loading & error states ──
    if (data.isLoading) {
        return (
            <div className="flex-1 flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 pt-24 pb-12 px-6">
                    <DashboardSkeleton />
                </main>
                <Footer />
            </div>
        );
    }

    if (data.error) {
        return (
            <div className="flex-1 flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <Card className="glass-card max-w-md">
                        <CardContent className="py-8 text-center">
                            <p className="text-foreground mb-2">Something went wrong</p>
                            <p className="text-sm text-muted-foreground">{data.error}</p>
                            <Button onClick={() => data.refetch()} className="mt-4">
                                Try Again
                            </Button>
                        </CardContent>
                    </Card>
                </main>
                <Footer />
            </div>
        );
    }

    const planCap = data.userPlan === "free" ? 1 : data.userPlan === "pro" ? 5 : 10;

    // ── Render ──
    return (
        <div className="flex-1 flex flex-col min-h-screen">
            <Header />

            {data.showOnboarding && (
                <OnboardingWizard
                    onComplete={async () => { await data.refetch(); }}
                    onSkip={data.dismissOnboarding}
                />
            )}

            {checkSuccess && (
                <div className="fixed top-20 right-4 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="bg-emerald-500/90 text-white px-4 py-3 rounded-lg shadow-lg text-sm">
                        {checkSuccess}
                    </div>
                </div>
            )}

            <AnalysisResultModal
                result={analysisResult}
                onClose={() => setAnalysisResult(null)}
            />

            <DeleteCompetitorDialog
                competitor={deletingCompetitor}
                onClose={() => setDeletingCompetitor(null)}
                onDeleted={handleDeleteComplete}
            />

            <EditCompetitorDialog
                competitor={editingCompetitor}
                onClose={() => setEditingCompetitor(null)}
                onSaved={handleEditSaved}
            />

            <PricingHistoryDialog
                competitor={historyCompetitor}
                userPlan={data.userPlan}
                onClose={() => setHistoryCompetitor(null)}
                onUpgrade={() => window.open("/#pricing", "_blank")}
            />

            {showCelebration && data.alerts[0] && (
                <FirstAlertCelebration
                    competitorName={data.alerts[0].competitors?.name || "your competitor"}
                    alertTitle={data.alerts[0].title || data.alerts[0].diff_summary || "Pricing change detected"}
                    onDismiss={() => setShowCelebration(false)}
                />
            )}

            <main className="flex-1 pt-24 pb-12 px-6">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-3">
                                <h1 className="font-display text-4xl text-foreground">Dashboard</h1>
                                <Badge
                                    variant={data.userPlan === "free" ? "outline" : "default"}
                                    className={cn(
                                        "uppercase tracking-wider text-[11px] px-2",
                                        data.userPlan === "pro" && "bg-emerald-500 text-black hover:bg-emerald-600 font-bold",
                                        data.userPlan === "enterprise" && "bg-purple-500 text-white hover:bg-purple-600 font-bold"
                                    )}
                                >
                                    {data.userPlan}
                                </Badge>
                                <span className="text-[11px] text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded-sm border border-border/50">
                                    {data.competitors.length} / {planCap} SLOTS
                                </span>
                            </div>
                            <p className="text-sm text-muted-foreground italic max-w-md">
                                Market intelligence grid active. Monitoring {data.competitors.length}{" "}
                                competitors for strategic shifts.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {data.userPlan === "free" && (
                                <Button
                                    variant="outline"
                                    className="border-white/10 text-white/90 hover:bg-white/5 hover:text-white gap-2 relative h-10 transition-all font-medium"
                                    onClick={() => router.push("/#pricing")}
                                >
                                    <Sparkles className="w-4 h-4 text-emerald-400" />
                                    Upgrade to Pro
                                </Button>
                            )}
                            <AddCompetitorDialog
                                existingCount={data.competitors.length}
                                onAdded={handleAdded}
                            />
                        </div>
                    </div>

                    {/* Market Radar (Pro only) */}
                    {data.userPlan !== "free" && data.radarData.length > 0 && (
                        <Card className="glass-card mb-8 overflow-hidden">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-xl font-display">
                                            Market Positioning Radar
                                        </CardTitle>
                                        <CardDescription>
                                            Competitive quadrant mapping: Feature Density vs. Starting Price
                                        </CardDescription>
                                    </div>
                                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                        PRO ANALYSIS
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                    <MarketRadar
                                        entities={data.radarData}
                                        className="aspect-square max-w-[400px] mx-auto"
                                    />
                                    <div className="space-y-4">
                                        <div className="p-5 bg-white/[0.03] rounded-xl border border-white/5 backdrop-blur-sm shadow-inner">
                                            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3 flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                Strategic Insight
                                            </h4>
                                            <p className="text-[13px] leading-relaxed text-slate-200 font-medium">
                                                {data.radarData.length > 2
                                                    ? "Competitive clustering detected in mid-market. Clear disruptor white-space exists in high-feature, low-price quadrant."
                                                    : "Aggregating data points. Add 2 more competitors to activate high-fidelity quadrant analysis."}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1">
                            <h2 className="font-mono text-sm text-muted-foreground uppercase tracking-wider mb-4">
                                Competitors ({data.competitors.length})
                            </h2>
                            <div className="space-y-4">
                                {data.competitors.length === 0 ? (
                                    <Card className="glass-card shadow-none border-dashed bg-transparent">
                                        <CardContent className="py-12 text-center relative overflow-hidden">
                                            <div className="relative z-20 flex flex-col items-center justify-center py-20 text-center">
                                                <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center mb-8">
                                                    <Plus className="w-10 h-10 text-emerald-400/50" />
                                                </div>
                                                <h3 className="font-display text-3xl text-white mb-3">
                                                    Build Your Intelligence Grid
                                                </h3>
                                                <p className="text-sm text-muted-foreground max-w-[280px] mb-10 leading-relaxed font-medium">
                                                    Initialize market monitoring by adding your first competitor.
                                                </p>
                                                <Button
                                                    variant="glow-emerald"
                                                    className="h-11 px-8 rounded-xl"
                                                    onClick={() => setIsForcedAddOpen(true)}
                                                >
                                                    <Plus className="w-4 h-4 mr-2 stroke-[3px]" />
                                                    Add First Competitor
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    data.competitors.map((competitor) => (
                                        <CompetitorCard
                                            key={competitor.id}
                                            competitor={competitor}
                                            analyzingId={analyzingId}
                                            onAnalyze={handleAnalyze}
                                            onViewHistory={handleViewHistory}
                                            onEdit={handleEdit}
                                            onDelete={setDeletingCompetitor}
                                            onNavigate={(id) =>
                                                router.push(`/dashboard/competitors/${id}`)
                                            }
                                        />
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="lg:col-span-2">
                            <DashboardAlertSummary
                                alerts={data.alerts.map((alert) => {
                                    let parsedTitle = alert.title || alert.diff_summary;
                                    try {
                                        if (alert.ai_insight) {
                                            const parsed = JSON.parse(alert.ai_insight);
                                            parsedTitle = parsed.whatChanged || parsedTitle;
                                        }
                                    } catch {
                                        // Keep original title
                                    }
                                    return {
                                        id: alert.id,
                                        competitor_name: alert.competitors?.name,
                                        type: (alert.type ||
                                            (alert.is_meaningful ? "price_increase" : "cta_changed")) as PricingDiffType,
                                        severity: (alert.severity ||
                                            (alert.is_meaningful ? "medium" : "low")) as AlertSeverity,
                                        title: parsedTitle,
                                        is_read: alert.is_read,
                                        created_at: alert.created_at,
                                    };
                                })}
                                onViewAlert={(id) => router.push(`/dashboard/alerts/${id}`)}
                                onViewAll={() => router.push("/dashboard/alerts")}
                            />
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
