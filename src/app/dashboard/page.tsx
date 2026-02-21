"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, RefreshCw, Loader2, Sparkles, History, Settings, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { DashboardAlertSummary } from "@/components/alerts";
import { OnboardingWizard } from "@/components/onboarding";
import type { PricingDiffType, AlertSeverity } from "@/lib/types";
import { MarketRadar, PricingTrendChart } from "@/components/charts";
import { cn } from "@/lib/utils";
import { analytics } from "@/components/providers/AnalyticsProvider";
import { toast } from "sonner";
import {
    CompetitorCard,
    AnalysisResultModal,
    DeleteCompetitorDialog,
    DashboardSkeleton,
} from "@/components/dashboard";

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

interface Competitor {
    id: string;
    name: string;
    url: string;
    status: "active" | "paused" | "error";
    last_checked_at: string | null;
    failure_count: number;
    created_at: string;
}

interface Alert {
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

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════

export default function Dashboard() {
    const router = useRouter();

    // Add competitor
    const [isAddingCompetitor, setIsAddingCompetitor] = useState(false);
    const [competitorName, setCompetitorName] = useState("");
    const [competitorUrl, setCompetitorUrl] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // Data
    const [competitors, setCompetitors] = useState<Competitor[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [checkSuccess, setCheckSuccess] = useState<string | null>(null);
    const [userPlan, setUserPlan] = useState<"free" | "pro" | "enterprise">("free");
    const [radarData, setRadarData] = useState<any[]>([]);
    const [showOnboarding, setShowOnboarding] = useState(false);

    // History dialog
    const [selectedHistoryComp, setSelectedHistoryComp] = useState<Competitor | null>(null);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [historyChartData, setHistoryChartData] = useState<any[]>([]);

    // Edit dialog
    const [editingCompetitor, setEditingCompetitor] = useState<Competitor | null>(null);
    const [editName, setEditName] = useState("");
    const [editUrl, setEditUrl] = useState("");
    const [isEditSubmitting, setIsEditSubmitting] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    // Delete dialog
    const [deletingCompetitor, setDeletingCompetitor] = useState<Competitor | null>(null);

    // Analysis
    const [analyzingId, setAnalyzingId] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<any | null>(null);

    // ══════════════════════════════════════════════════════════════════════════
    // DATA FETCHING
    // ══════════════════════════════════════════════════════════════════════════

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

            if ((competitorsData.competitors || []).length === 0) {
                setShowOnboarding(true);
            }

            // Market Radar (Pro Only)
            if (competitorsData.plan !== "free") {
                const radarRes = await fetch("/api/market-radar");
                if (radarRes.ok) {
                    const radarJson = await radarRes.json();
                    setRadarData(radarJson.data || []);
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load data");
        } finally {
            setIsLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchData();
        const userCreatedAt = localStorage.getItem("userCreatedAt");
        if (userCreatedAt) {
            const daysSinceSignup = Math.floor(
                (Date.now() - new Date(userCreatedAt).getTime()) / (1000 * 60 * 60 * 24)
            );
            analytics.dashboardVisit(daysSinceSignup);
        } else {
            analytics.dashboardVisit(0);
        }
    }, [fetchData]);

    // ══════════════════════════════════════════════════════════════════════════
    // HANDLERS
    // ══════════════════════════════════════════════════════════════════════════

    const handleAddCompetitor = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitError(null);

        try {
            const res = await fetch("/api/competitors", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: competitorName, url: competitorUrl }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to add competitor");
            }

            setCompetitors((prev) => [data.competitor, ...prev]);
            analytics.competitorAdded(competitors.length + 1);
            setIsAddingCompetitor(false);
            setCompetitorName("");
            setCompetitorUrl("");
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : "Failed to add competitor");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOnboardingComplete = async (url: string, name: string) => {
        const res = await fetch("/api/competitors", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, url }),
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Failed to add competitor");
        }

        const data = await res.json();
        setCompetitors((prev) => [data.competitor, ...prev]);
    };

    const handleAnalyze = async (competitorId: string) => {
        setAnalyzingId(competitorId);
        setAnalysisResult(null);

        try {
            const res = await fetch("/api/analyze-competitor", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ competitorId }),
            });

            const data = await res.json();

            if (!res.ok) {
                toast.error(data.error || "Analysis failed");
                return;
            }

            setAnalysisResult(data.analysis);

            const competitor = competitors.find((c) => c.id === competitorId);
            const changeMsg = data.hasChanged
                ? "🔴 Changes detected!"
                : "✓ No changes since last analysis";
            setCheckSuccess(`${changeMsg} ${competitor?.name || "Page"} analyzed.`);
            setTimeout(() => setCheckSuccess(null), 5000);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Analysis failed");
        } finally {
            setAnalyzingId(null);
        }
    };

    const handleViewHistory = async (comp: Competitor) => {
        if (userPlan === "free") {
            window.open("/#pricing", "_blank");
            return;
        }

        setSelectedHistoryComp(comp);
        setIsHistoryLoading(true);
        try {
            const res = await fetch(`/api/competitors/${comp.id}/history`);
            if (res.ok) {
                const data = await res.json();
                const chartPoints = data.history
                    .map((h: any) => {
                        const plans = h.plans || [];
                        const prices = plans
                            .map((p: any) => {
                                const priceStr = p.price_raw?.replace(/[^0-9.]/g, "");
                                return parseFloat(priceStr || "0");
                            })
                            .filter((v: number) => v > 0);
                        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
                        return { date: h.date, price: minPrice };
                    })
                    .filter((p: any) => p.price > 0);

                setHistoryChartData(chartPoints);
            }
        } catch (err) {
            console.error("Failed to load history:", err);
        } finally {
            setIsHistoryLoading(false);
        }
    };

    const handleEditCompetitor = async () => {
        if (!editingCompetitor) return;

        setIsEditSubmitting(true);
        setEditError(null);

        try {
            const res = await fetch(`/api/competitors/${editingCompetitor.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: editName !== editingCompetitor.name ? editName : undefined,
                    url: editUrl !== editingCompetitor.url ? editUrl : undefined,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setEditError(data.error || "Failed to update competitor");
                return;
            }

            setCompetitors((prev) =>
                prev.map((c) => (c.id === editingCompetitor.id ? data.competitor : c))
            );

            const message = data.historyReset
                ? `✓ ${data.competitor.name} updated. Historical data has been reset.`
                : `✓ ${data.competitor.name} updated successfully.`;
            setCheckSuccess(message);
            setTimeout(() => setCheckSuccess(null), 5000);

            setEditingCompetitor(null);
            setEditName("");
            setEditUrl("");
        } catch (err) {
            setEditError(err instanceof Error ? err.message : "Failed to update competitor");
        } finally {
            setIsEditSubmitting(false);
        }
    };

    const openEditDialog = (competitor: Competitor) => {
        setEditingCompetitor(competitor);
        setEditName(competitor.name);
        setEditUrl(competitor.url);
        setEditError(null);
    };

    const handleDeleteComplete = (id: string) => {
        setCompetitors((prev) => prev.filter((c) => c.id !== id));
    };

    const urlIsChanging = editingCompetitor && editUrl !== editingCompetitor.url;

    // ══════════════════════════════════════════════════════════════════════════
    // LOADING STATE
    // ══════════════════════════════════════════════════════════════════════════

    if (isLoading) {
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

    if (error) {
        return (
            <div className="flex-1 flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <Card className="glass-card max-w-md">
                        <CardContent className="py-8 text-center">
                            <p className="text-foreground mb-2">Something went wrong</p>
                            <p className="text-sm text-muted-foreground">{error}</p>
                            <Button onClick={() => fetchData()} className="mt-4">
                                Try Again
                            </Button>
                        </CardContent>
                    </Card>
                </main>
                <Footer />
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ══════════════════════════════════════════════════════════════════════════

    return (
        <div className="flex-1 flex flex-col min-h-screen">
            <Header />

            {/* Onboarding Wizard */}
            {showOnboarding && (
                <OnboardingWizard
                    onComplete={handleOnboardingComplete}
                    onSkip={() => setShowOnboarding(false)}
                />
            )}

            {/* Success Toast */}
            {checkSuccess && (
                <div className="fixed top-20 right-4 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="bg-emerald-500/90 text-white px-4 py-3 rounded-lg shadow-lg text-sm">
                        {checkSuccess}
                    </div>
                </div>
            )}

            {/* Analysis Results Modal */}
            <AnalysisResultModal
                result={analysisResult}
                onClose={() => setAnalysisResult(null)}
            />

            {/* Delete Competitor Dialog */}
            <DeleteCompetitorDialog
                competitor={deletingCompetitor}
                onClose={() => setDeletingCompetitor(null)}
                onDeleted={handleDeleteComplete}
            />

            <main className="flex-1 pt-24 pb-12 px-6">
                <div className="max-w-6xl mx-auto">
                    {/* Dashboard Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-3">
                                <h1 className="font-display text-4xl text-foreground">Dashboard</h1>
                                <Badge
                                    variant={userPlan === "free" ? "outline" : "default"}
                                    className={cn(
                                        "uppercase tracking-wider text-[11px] px-2",
                                        userPlan === "pro" &&
                                        "bg-emerald-500 text-black hover:bg-emerald-600 font-bold",
                                        userPlan === "enterprise" &&
                                        "bg-purple-500 text-white hover:bg-purple-600 font-bold"
                                    )}
                                >
                                    {userPlan}
                                </Badge>
                                <span className="text-[11px] text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded-sm border border-border/50">
                                    {competitors.length} /{" "}
                                    {userPlan === "free" ? 1 : userPlan === "pro" ? 5 : "10"} SLOTS
                                </span>
                            </div>
                            <p className="text-sm text-muted-foreground italic max-w-md">
                                Market intelligence grid active. Monitoring {competitors.length}{" "}
                                competitors for strategic shifts.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {userPlan === "free" && (
                                <Button
                                    variant="outline"
                                    className="border-white/10 text-white/90 hover:bg-white/5 hover:text-white gap-2 relative h-10 transition-all font-medium"
                                    onClick={() => router.push("/#pricing")}
                                >
                                    <Sparkles className="w-4 h-4 text-emerald-400" />
                                    Upgrade to Pro
                                </Button>
                            )}
                            <Dialog open={isAddingCompetitor} onOpenChange={setIsAddingCompetitor}>
                                <DialogTrigger asChild>
                                    <Button variant="glow-emerald" className="gap-2 h-10 px-5">
                                        <Plus className="w-4 h-4 stroke-[3px]" />
                                        Add Competitor
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle className="font-display text-xl">
                                            Add a Competitor
                                        </DialogTitle>
                                        <DialogDescription>
                                            Enter their pricing or homepage URL. We&apos;ll take a snapshot
                                            immediately.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleAddCompetitor} className="space-y-4 mt-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="name">Competitor Name</Label>
                                            <Input
                                                id="name"
                                                placeholder="e.g. Acme Corp"
                                                value={competitorName}
                                                onChange={(e) => setCompetitorName(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="url">Page URL</Label>
                                            <Input
                                                id="url"
                                                type="url"
                                                placeholder="https://acme.com/pricing"
                                                value={competitorUrl}
                                                onChange={(e) => setCompetitorUrl(e.target.value)}
                                                required
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Tip: Pricing pages work best for meaningful alerts.
                                            </p>
                                        </div>
                                        {submitError && (
                                            <p className="text-sm text-red-500">{submitError}</p>
                                        )}
                                        <div className="flex gap-3 pt-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => setIsAddingCompetitor(false)}
                                                className="flex-1"
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                type="submit"
                                                className="flex-1"
                                                disabled={
                                                    isSubmitting || !competitorName || !competitorUrl
                                                }
                                            >
                                                {isSubmitting ? (
                                                    <>
                                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                                        Adding...
                                                    </>
                                                ) : (
                                                    "Add & Monitor"
                                                )}
                                            </Button>
                                        </div>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>

                    {/* Strategic Market Radar (Pro Only) */}
                    {userPlan !== "free" && (
                        <Card className="glass-card mb-8 overflow-hidden">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-xl font-display">
                                            Market Positioning Radar
                                        </CardTitle>
                                        <CardDescription>
                                            Competitive quadrant mapping: Feature Density vs. Starting
                                            Price
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
                                        entities={radarData}
                                        className="aspect-square max-w-[400px] mx-auto"
                                    />
                                    <div className="space-y-4">
                                        <div className="p-5 bg-white/[0.03] rounded-xl border border-white/5 backdrop-blur-sm shadow-inner">
                                            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3 flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                Strategic Insight
                                            </h4>
                                            <p className="text-[13px] leading-relaxed text-slate-200 font-medium">
                                                {radarData.length > 2
                                                    ? "Competitive clustering detected in mid-market. Clear disruptor white-space exists in high-feature, low-price quadrant."
                                                    : "Aggregating data points. Add 2 more competitors to activate high-fidelity quadrant analysis."}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="text-center p-4 border border-white/5 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] transition-colors group">
                                                <div className="text-3xl font-display text-white group-hover:text-emerald-400 transition-colors">
                                                    {radarData.length}
                                                </div>
                                                <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mt-1">
                                                    Nodes Mapped
                                                </div>
                                            </div>
                                            <div className="text-center p-4 border border-white/5 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] transition-colors group">
                                                <div className="text-3xl font-display text-white group-hover:text-emerald-400 transition-colors">
                                                    {radarData.length > 0
                                                        ? (
                                                            radarData.reduce(
                                                                (acc, curr) =>
                                                                    acc + curr.featureDensity,
                                                                0
                                                            ) / radarData.length
                                                        ).toFixed(1)
                                                        : "0"}
                                                </div>
                                                <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mt-1">
                                                    Avg Efficiency
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Competitors Column */}
                        <div className="lg:col-span-1">
                            <h2 className="font-mono text-sm text-muted-foreground uppercase tracking-wider mb-4">
                                Competitors ({competitors.length})
                            </h2>

                            <div className="space-y-4">
                                {competitors.length === 0 ? (
                                    <Card className="glass-card shadow-none border-dashed bg-transparent">
                                        <CardContent className="py-12 text-center relative overflow-hidden">
                                            <div className="absolute inset-0 pointer-events-none opacity-10">
                                                <svg
                                                    width="100%"
                                                    height="100%"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                >
                                                    <defs>
                                                        <pattern
                                                            id="dotGridLarge"
                                                            width="20"
                                                            height="20"
                                                            patternUnits="userSpaceOnUse"
                                                        >
                                                            <circle
                                                                cx="2"
                                                                cy="2"
                                                                r="1.5"
                                                                fill="currentColor"
                                                                className="text-muted-foreground"
                                                            />
                                                        </pattern>
                                                    </defs>
                                                    <rect
                                                        width="100%"
                                                        height="100%"
                                                        fill="url(#dotGridLarge)"
                                                    />
                                                </svg>
                                            </div>
                                            <div className="relative z-20 flex flex-col items-center justify-center py-20 text-center">
                                                <div className="relative mb-8">
                                                    <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" />
                                                    <div className="relative w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center rotate-3 hover:rotate-0 transition-transform duration-500 shadow-2xl">
                                                        <Plus className="w-10 h-10 text-emerald-400/50" />
                                                    </div>
                                                </div>
                                                <h3 className="font-display text-3xl text-white mb-3">
                                                    Build Your Intelligence Grid
                                                </h3>
                                                <p className="text-sm text-muted-foreground max-w-[280px] mb-10 leading-relaxed font-medium">
                                                    Initialize market monitoring by adding your first
                                                    competitor to the observation matrix.
                                                </p>
                                                <Button
                                                    variant="glow-emerald"
                                                    className="h-11 px-8 rounded-xl"
                                                    onClick={() => setIsAddingCompetitor(true)}
                                                >
                                                    <Plus className="w-4 h-4 mr-2 stroke-[3px]" />
                                                    Add First Competitor
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    competitors.map((competitor) => (
                                        <CompetitorCard
                                            key={competitor.id}
                                            competitor={competitor}
                                            analyzingId={analyzingId}
                                            onAnalyze={handleAnalyze}
                                            onViewHistory={handleViewHistory}
                                            onEdit={openEditDialog}
                                            onDelete={setDeletingCompetitor}
                                            onNavigate={(id) =>
                                                router.push(`/dashboard/competitors/${id}`)
                                            }
                                        />
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Alerts Column */}
                        <div className="lg:col-span-2">
                            <DashboardAlertSummary
                                alerts={alerts.map((alert) => {
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
                                            (alert.is_meaningful
                                                ? "price_increase"
                                                : "cta_changed")) as PricingDiffType,
                                        severity: (alert.severity ||
                                            (alert.is_meaningful
                                                ? "medium"
                                                : "low")) as AlertSeverity,
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

            {/* Pricing History Dialog */}
            <Dialog
                open={!!selectedHistoryComp}
                onOpenChange={(open) => !open && setSelectedHistoryComp(null)}
            >
                <DialogContent className="max-w-3xl glass-card">
                    <DialogHeader>
                        <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                AGENTIC INTELLIGENCE
                            </Badge>
                        </div>
                        <DialogTitle className="text-2xl font-display">
                            {selectedHistoryComp?.name} Pricing Trajectory
                        </DialogTitle>
                        <DialogDescription>
                            Historical Price Movements for {selectedHistoryComp?.url}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-6">
                        {isHistoryLoading ? (
                            <div className="h-[300px] flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
                            </div>
                        ) : historyChartData.length > 0 ? (
                            <PricingTrendChart data={historyChartData} className="w-full" />
                        ) : (
                            <div className="h-[300px] flex flex-col items-center justify-center text-center p-8 bg-muted/20 rounded-xl border border-dashed">
                                <History className="w-12 h-12 text-muted-foreground/30 mb-4" />
                                <h4 className="font-medium text-foreground">Awaiting More Data</h4>
                                <p className="text-sm text-muted-foreground max-w-xs mt-2">
                                    Chronological pricing trends populate as RivalEye completes more
                                    daily checks for this competitor.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button
                            variant="outline"
                            onClick={() => setSelectedHistoryComp(null)}
                        >
                            Close Analysis
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Competitor Dialog */}
            <Dialog
                open={!!editingCompetitor}
                onOpenChange={(open) => !open && setEditingCompetitor(null)}
            >
                <DialogContent className="sm:max-w-md glass-card">
                    <DialogHeader>
                        <DialogTitle className="font-display text-xl">
                            Edit Competitor
                        </DialogTitle>
                        <DialogDescription>
                            Update competitor details. Changing the URL will reset all historical
                            data.
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleEditCompetitor();
                        }}
                        className="space-y-4 mt-4"
                    >
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Competitor Name</Label>
                            <Input
                                id="edit-name"
                                placeholder="e.g. Acme Corp"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-url">Page URL</Label>
                            <Input
                                id="edit-url"
                                type="url"
                                placeholder="https://acme.com/pricing"
                                value={editUrl}
                                onChange={(e) => setEditUrl(e.target.value)}
                                required
                            />
                        </div>

                        {urlIsChanging && (
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-amber-500">
                                        Historical data will be reset
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Changing the URL will delete all snapshots and alerts for
                                        this competitor. This ensures data integrity for the new
                                        target.
                                    </p>
                                </div>
                            </div>
                        )}

                        {editError && (
                            <p className="text-sm text-red-500">{editError}</p>
                        )}

                        <div className="flex gap-3 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEditingCompetitor(null)}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant={urlIsChanging ? "destructive" : "default"}
                                disabled={isEditSubmitting || (!editName && !editUrl)}
                                className={cn("flex-1", !urlIsChanging && "glow-emerald")}
                            >
                                {isEditSubmitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : urlIsChanging ? (
                                    "Save & Reset History"
                                ) : (
                                    "Save Changes"
                                )}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
