"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ExternalLink, RefreshCw, Clock, AlertCircle, CheckCircle2, Loader2, Sparkles, LineChart, History, Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { DashboardAlertSummary } from "@/components/alerts";
import type { PricingDiffType, AlertSeverity } from "@/lib/types";
import { MarketRadar, PricingTrendChart } from "@/components/charts";
import { cn } from "@/lib/utils";

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
    type?: "price_increase" | "price_decrease" | "plan_added" | "plan_removed" | "free_tier_removed" | "free_tier_added" | "plan_promoted" | "cta_changed" | "regional_difference";
    severity?: "high" | "medium" | "low";
    title?: string;
    description?: string;
    details?: {
        context?: string;
        before?: string | null;
        after?: string | null;
        aiExplanation?: string;
    };
    created_at: string;
    competitors?: {
        name: string;
    };
}

function formatRelativeTime(dateString: string | null): string {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

export default function Dashboard() {
    const router = useRouter();
    const [isAddingCompetitor, setIsAddingCompetitor] = useState(false);
    const [competitorName, setCompetitorName] = useState("");
    const [competitorUrl, setCompetitorUrl] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const [competitors, setCompetitors] = useState<Competitor[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [checkingId, setCheckingId] = useState<string | null>(null);
    const [checkSuccess, setCheckSuccess] = useState<string | null>(null);
    const [userPlan, setUserPlan] = useState<"free" | "pro" | "enterprise">("free");
    const [radarData, setRadarData] = useState<any[]>([]);
    const [isRadarLoading, setIsRadarLoading] = useState(false);
    const [selectedHistoryComp, setSelectedHistoryComp] = useState<Competitor | null>(null);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [historyChartData, setHistoryChartData] = useState<any[]>([]);

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

            // Handle Radar Data (Pro Only)
            if (competitorsData.plan !== "free") {
                setIsRadarLoading(true);
                const radarRes = await fetch("/api/market-radar");
                if (radarRes.ok) {
                    const radarJson = await radarRes.json();
                    setRadarData(radarJson.data || []);
                }
                setIsRadarLoading(false);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load data");
        } finally {
            setIsLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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
            setIsAddingCompetitor(false);
            setCompetitorName("");
            setCompetitorUrl("");
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : "Failed to add competitor");
        } finally {
            setIsSubmitting(false);
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

                // Process history data for the chart
                // We take the cheapest plan price for the trend
                const chartPoints = data.history.map((h: any) => {
                    const plans = h.plans || [];
                    const prices = plans
                        .map((p: any) => {
                            const priceStr = p.price_raw?.replace(/[^0-9.]/g, '');
                            return parseFloat(priceStr || '0');
                        })
                        .filter((v: number) => v > 0);

                    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;

                    return {
                        date: h.date,
                        price: minPrice
                    };
                }).filter((p: any) => p.price > 0);

                setHistoryChartData(chartPoints);
            }
        } catch (err) {
            console.error("Failed to load history:", err);
        } finally {
            setIsHistoryLoading(false);
        }
    };

    const handleCheckNow = async (competitorId: string) => {
        setCheckingId(competitorId);

        try {
            const res = await fetch("/api/check-now", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ competitorId }),
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.error || "Check failed");
                return;
            }

            // Update the competitor's last_checked_at
            setCompetitors((prev) =>
                prev.map((c) =>
                    c.id === competitorId
                        ? { ...c, last_checked_at: new Date().toISOString(), failure_count: 0 }
                        : c
                )
            );

            // Refresh alerts
            const alertsRes = await fetch("/api/alerts");
            if (alertsRes.ok) {
                const alertsData = await alertsRes.json();
                setAlerts(alertsData.alerts || []);
            }

            // Show success message
            const competitor = competitors.find((c) => c.id === competitorId);
            setCheckSuccess(`✓ ${competitor?.name || "Page"} checked successfully. Snapshot saved.`);
            setTimeout(() => setCheckSuccess(null), 4000);
        } catch (err) {
            alert(err instanceof Error ? err.message : "Check failed");
        } finally {
            setCheckingId(null);
        }
    };

    const [analyzingId, setAnalyzingId] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<{
        companyName?: string;
        tagline?: string;
        pricing?: {
            plans?: Array<{ name: string; price: string; period?: string; credits?: string; features?: string[] }>;
            promotions?: string[];
        };
        features?: {
            highlighted?: string[];
            differentiators?: string[];
        };
        positioning?: {
            targetAudience?: string;
            valueProposition?: string;
            socialProof?: string[];
        };
        insights?: string[];
        summary?: string;
    } | null>(null);

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
                alert(data.error || "Analysis failed");
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
            alert(err instanceof Error ? err.message : "Analysis failed");
        } finally {
            setAnalyzingId(null);
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
                    <Card className="glass-card max-w-md">
                        <CardContent className="py-8 text-center">
                            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
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

    return (
        <div className="flex-1 flex flex-col min-h-screen">
            <Header />

            {/* Success Toast */}
            {checkSuccess && (
                <div className="fixed top-20 right-4 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="bg-emerald-500/90 text-white px-4 py-3 rounded-lg shadow-lg text-sm">
                        {checkSuccess}
                    </div>
                </div>
            )}

            {/* Analysis Results Modal */}
            {analysisResult && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="glass-card max-w-2xl w-full max-h-[80vh] overflow-auto">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <span>🔍</span>
                                AI Analysis: {analysisResult.companyName}
                            </CardTitle>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setAnalysisResult(null)}
                            >
                                ✕
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Executive Summary */}
                            {analysisResult.summary && (
                                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                                    <p className="text-sm text-foreground">{analysisResult.summary}</p>
                                </div>
                            )}

                            {/* Tagline */}
                            {analysisResult.tagline && (
                                <p className="text-muted-foreground italic">"{analysisResult.tagline}"</p>
                            )}

                            {/* Pricing Plans */}
                            {analysisResult.pricing?.plans && analysisResult.pricing.plans.length > 0 && (
                                <div>
                                    <h3 className="font-semibold mb-3 text-foreground">💰 Pricing Plans</h3>
                                    <div className="grid gap-3">
                                        {analysisResult.pricing.plans.map((plan: { name: string; price: string; period?: string; credits?: string; features?: string[] }, i: number) => (
                                            <div key={i} className="border border-border/50 rounded-lg p-3 bg-surface-elevated/50">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-medium text-foreground">{plan.name}</span>
                                                    <span className="text-emerald-400 font-bold">{plan.price}{plan.period ? `/${plan.period}` : ""}</span>
                                                </div>
                                                {plan.credits && (
                                                    <p className="text-sm text-muted-foreground">{plan.credits}</p>
                                                )}
                                                {plan.features && plan.features.length > 0 && (
                                                    <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                                                        {plan.features.slice(0, 4).map((f: string, j: number) => (
                                                            <li key={j}>• {f}</li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {analysisResult.pricing.promotions && analysisResult.pricing.promotions.length > 0 && (
                                        <div className="mt-3 text-sm text-amber-400">
                                            🎁 {analysisResult.pricing.promotions.join(" • ")}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Features */}
                            {analysisResult.features?.highlighted && analysisResult.features.highlighted.length > 0 && (
                                <div>
                                    <h3 className="font-semibold mb-3 text-foreground">✨ Key Features</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {analysisResult.features.highlighted.map((f: string, i: number) => (
                                            <span key={i} className="px-2 py-1 bg-surface-elevated text-xs rounded-full text-muted-foreground">
                                                {f}
                                            </span>
                                        ))}
                                    </div>
                                    {analysisResult.features.differentiators && analysisResult.features.differentiators.length > 0 && (
                                        <div className="mt-3">
                                            <p className="text-xs text-muted-foreground mb-1">Differentiators:</p>
                                            <ul className="text-sm text-foreground space-y-1">
                                                {analysisResult.features.differentiators.map((d: string, i: number) => (
                                                    <li key={i}>→ {d}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Target Audience */}
                            {analysisResult.positioning?.targetAudience && (
                                <div>
                                    <h3 className="font-semibold mb-2 text-foreground">🎯 Target Audience</h3>
                                    <p className="text-sm text-muted-foreground">{analysisResult.positioning.targetAudience}</p>
                                    {analysisResult.positioning.valueProposition && (
                                        <p className="text-sm text-emerald-400 mt-2">"{analysisResult.positioning.valueProposition}"</p>
                                    )}
                                </div>
                            )}

                            {/* Social Proof */}
                            {analysisResult.positioning?.socialProof && analysisResult.positioning.socialProof.length > 0 && (
                                <div>
                                    <h3 className="font-semibold mb-2 text-foreground">🏆 Social Proof</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {analysisResult.positioning.socialProof.map((s: string, i: number) => (
                                            <span key={i} className="px-2 py-1 bg-amber-500/10 text-xs rounded-full text-amber-400">
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Key Insights */}
                            {analysisResult.insights && analysisResult.insights.length > 0 && (
                                <div>
                                    <h3 className="font-semibold mb-3 text-foreground">💡 Key Insights</h3>
                                    <ul className="space-y-2">
                                        {analysisResult.insights.map((insight: string, i: number) => (
                                            <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                                                <span className="text-emerald-400 shrink-0">→</span>
                                                {insight}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            <main className="flex-1 pt-24 pb-12 px-6">
                <div className="max-w-6xl mx-auto">
                    {/* Dashboard Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="font-display text-4xl text-foreground">Dashboard</h1>
                                <Badge variant={userPlan === "free" ? "outline" : "default"} className={cn(
                                    "uppercase tracking-wider text-[10px]",
                                    userPlan === "pro" && "bg-emerald-500 text-black hover:bg-emerald-600 font-bold",
                                    userPlan === "enterprise" && "bg-purple-500 text-white hover:bg-purple-600 font-bold"
                                )}>
                                    {userPlan}
                                </Badge>
                                <span className="text-xs text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded">
                                    {competitors.length} / {userPlan === "free" ? 1 : userPlan === "pro" ? 5 : "10"} Competitors
                                </span>
                            </div>
                            <p className="text-muted-foreground">
                                Monitoring your competitors for changes.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {userPlan === "free" && (
                                <Button
                                    variant="outline"
                                    className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 gap-2 relative overflow-hidden group saber-border h-9"
                                    onClick={() => router.push("/#pricing")}
                                >
                                    <Sparkles className="w-4 h-4" />
                                    Upgrade to Pro
                                </Button>
                            )}
                            <Dialog open={isAddingCompetitor} onOpenChange={setIsAddingCompetitor}>
                                <DialogTrigger asChild>
                                    <Button className="glow-emerald gap-2">
                                        <Plus className="w-4 h-4" />
                                        Add Competitor
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle className="font-display text-xl">Add a Competitor</DialogTitle>
                                        <DialogDescription>
                                            Enter their pricing or homepage URL. We&apos;ll take a snapshot immediately.
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
                                                disabled={isSubmitting || !competitorName || !competitorUrl}
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
                                        <CardTitle className="text-xl font-display">Market Positioning Radar</CardTitle>
                                        <CardDescription>Competitive quadrant mapping: Feature Density vs. Starting Price</CardDescription>
                                    </div>
                                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">PRO ANALYSIS</Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                    <MarketRadar entities={radarData} className="aspect-square max-w-[400px] mx-auto" />
                                    <div className="space-y-4">
                                        <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                                            <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Strategic Insight</h4>
                                            <p className="text-sm leading-relaxed">
                                                {radarData.length > 2 ? (
                                                    "Your competitors are primarily clustered in the center. There's a clear 'Disruptor' white space in the top-left quadrant for a high-feature, mid-price offering."
                                                ) : (
                                                    "Add more competitors to unlock full quadrant analysis and spot market entry opportunities."
                                                )}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="text-center p-3 border rounded-lg bg-surface">
                                                <div className="text-2xl font-display text-blue-400">{radarData.length}</div>
                                                <div className="text-[10px] uppercase text-muted-foreground">Competitors Mapped</div>
                                            </div>
                                            <div className="text-center p-3 border rounded-lg bg-surface">
                                                <div className="text-2xl font-display text-emerald-400">
                                                    {radarData.length > 0 ? (radarData.reduce((acc, curr) => acc + curr.featureDensity, 0) / radarData.length).toFixed(1) : "0"}
                                                </div>
                                                <div className="text-[10px] uppercase text-muted-foreground">Avg Feature Score</div>
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
                                            {/* Architectural Background Pattern */}
                                            <div className="absolute inset-0 pointer-events-none opacity-10">
                                                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                                                    <defs>
                                                        <pattern id="dotGridLarge" width="20" height="20" patternUnits="userSpaceOnUse">
                                                            <circle cx="2" cy="2" r="1.5" fill="currentColor" className="text-muted-foreground" />
                                                        </pattern>
                                                    </defs>
                                                    <rect width="100%" height="100%" fill="url(#dotGridLarge)" />
                                                </svg>
                                            </div>

                                            <div className="relative z-10">
                                                <div className="w-16 h-16 rounded-full bg-muted/30 border border-muted/50 flex items-center justify-center mx-auto mb-6">
                                                    <Plus className="w-8 h-8 text-muted-foreground/30" />
                                                </div>
                                                <h3 className="text-base font-display text-foreground mb-2">Build Your Intelligence Grid</h3>
                                                <p className="text-sm text-muted-foreground max-w-[240px] mx-auto mb-8 leading-relaxed">
                                                    Add your first competitor to begin mapping the market landscape.
                                                </p>
                                                <Button
                                                    className="glow-emerald"
                                                    onClick={() => setIsAddingCompetitor(true)}
                                                >
                                                    Initialize Monitoring
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    competitors.map((competitor) => (
                                        <Card
                                            key={competitor.id}
                                            className="glass-card hover:border-emerald-500/30 transition-colors cursor-pointer"
                                        >
                                            <CardHeader className="pb-2">
                                                <div className="flex items-start justify-between">
                                                    <CardTitle className="text-base font-medium">
                                                        {competitor.name}
                                                    </CardTitle>
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="w-7 h-7 text-muted-foreground hover:text-emerald-400"
                                                            onClick={() => handleViewHistory(competitor)}
                                                            title="View History"
                                                        >
                                                            <LineChart className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="w-7 h-7 text-muted-foreground hover:text-foreground"
                                                            onClick={() => window.open(competitor.url, "_blank")}
                                                            title="Direct Link"
                                                        >
                                                            <ExternalLink className="w-4 h-4" />
                                                        </Button>
                                                        <Badge
                                                            variant={competitor.status === "active" ? "default" : "secondary"}
                                                            className="text-[10px] h-5"
                                                        >
                                                            {competitor.status}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <CardDescription className="text-xs truncate">
                                                    {competitor.url}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {formatRelativeTime(competitor.last_checked_at)}
                                                    </span>
                                                    {competitor.failure_count > 0 && (
                                                        <span className="flex items-center gap-1 text-amber-500">
                                                            <AlertCircle className="w-3 h-3" />
                                                            {competitor.failure_count} failures
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 mt-4">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-xs h-8 bg-surface-elevated/50 flex items-center gap-2 group hover:border-emerald-500/30"
                                                        onClick={() => handleCheckNow(competitor.id)}
                                                        disabled={checkingId === competitor.id}
                                                    >
                                                        {checkingId === competitor.id ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <RefreshCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
                                                        )}
                                                        Check
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-xs h-8 bg-emerald-500/5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
                                                        onClick={() => handleAnalyze(competitor.id)}
                                                        disabled={analyzingId === competitor.id}
                                                    >
                                                        {analyzingId === competitor.id ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <span>Analyze</span>
                                                        )}
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Alerts Column */}
                        <div className="lg:col-span-2">
                            <DashboardAlertSummary
                                alerts={alerts.map((alert) => {
                                    // Parse ai_insight to get title if needed
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
                                        type: (alert.type || (alert.is_meaningful ? "price_increase" : "cta_changed")) as PricingDiffType,
                                        severity: (alert.severity || (alert.is_meaningful ? "medium" : "low")) as AlertSeverity,
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
            <Dialog open={!!selectedHistoryComp} onOpenChange={(open) => !open && setSelectedHistoryComp(null)}>
                <DialogContent className="max-w-3xl glass-card">
                    <DialogHeader>
                        <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">AGENTIC INTELLIGENCE</Badge>
                        </div>
                        <DialogTitle className="text-2xl font-display">{selectedHistoryComp?.name} Pricing Trajectory</DialogTitle>
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
                                    Chronological pricing trends populate as RivalEye completes more daily checks for this competitor.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button variant="outline" onClick={() => setSelectedHistoryComp(null)}>Close Analysis</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
