"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ExternalLink, RefreshCw, Clock, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";

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
    created_at: string;
    competitors: {
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
            setAlerts(alertsData.alerts || []);
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
                            <h1 className="font-display text-3xl text-foreground mb-1">
                                Dashboard
                            </h1>
                            <p className="text-muted-foreground">
                                Monitor your competitors and stay informed.
                            </p>
                        </div>

                        <Dialog open={isAddingCompetitor} onOpenChange={setIsAddingCompetitor}>
                            <DialogTrigger asChild>
                                <Button className="gap-2">
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

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Competitors Column */}
                        <div className="lg:col-span-1">
                            <h2 className="font-mono text-sm text-muted-foreground uppercase tracking-wider mb-4">
                                Competitors ({competitors.length})
                            </h2>

                            <div className="space-y-4">
                                {competitors.length === 0 ? (
                                    <Card className="glass-card">
                                        <CardContent className="py-8 text-center">
                                            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                                                <Plus className="w-6 h-6 text-muted-foreground" />
                                            </div>
                                            <p className="text-muted-foreground text-sm mb-4">
                                                No competitors yet.<br />Add one to get started.
                                            </p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setIsAddingCompetitor(true)}
                                            >
                                                Add Competitor
                                            </Button>
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
                                                    <Badge
                                                        variant={competitor.status === "active" ? "default" : "secondary"}
                                                        className="text-xs"
                                                    >
                                                        {competitor.status}
                                                    </Badge>
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
                                                <div className="flex gap-2 mt-4">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="flex-1 text-xs"
                                                        onClick={() => handleCheckNow(competitor.id)}
                                                        disabled={checkingId === competitor.id}
                                                    >
                                                        {checkingId === competitor.id ? (
                                                            <>
                                                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                                Checking...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <RefreshCw className="w-3 h-3 mr-1" />
                                                                Check Now
                                                            </>
                                                        )}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="flex-1 text-xs bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20"
                                                        onClick={() => handleAnalyze(competitor.id)}
                                                        disabled={analyzingId === competitor.id}
                                                    >
                                                        {analyzingId === competitor.id ? (
                                                            <>
                                                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                                Analyzing...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="mr-1">🔍</span>
                                                                Analyze
                                                            </>
                                                        )}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-xs"
                                                        onClick={() => window.open(competitor.url, "_blank")}
                                                    >
                                                        <ExternalLink className="w-3 h-3" />
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
                            <h2 className="font-mono text-sm text-muted-foreground uppercase tracking-wider mb-4">
                                Recent Alerts
                            </h2>

                            <div className="space-y-4">
                                {alerts.length === 0 ? (
                                    <Card className="glass-card">
                                        <CardContent className="py-12 text-center">
                                            <CheckCircle2 className="w-12 h-12 text-emerald-500/50 mx-auto mb-4" />
                                            <p className="text-muted-foreground">
                                                No alerts yet. We&apos;ll email you when something changes.
                                            </p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    alerts.map((alert) => {
                                        let insight = { whatChanged: "", whyItMatters: "", whatToDo: "" };
                                        try {
                                            insight = JSON.parse(alert.ai_insight);
                                        } catch {
                                            insight.whatChanged = alert.diff_summary;
                                        }

                                        return (
                                            <Card
                                                key={alert.id}
                                                className="glass-card hover:border-emerald-500/30 transition-colors cursor-pointer border-l-2 border-l-emerald-500"
                                            >
                                                <CardHeader className="pb-2">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-xs capitalize border-emerald-500/30 text-emerald-400"
                                                                >
                                                                    {alert.is_meaningful ? "meaningful" : "minor"}
                                                                </Badge>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {alert.competitors?.name}
                                                                </span>
                                                            </div>
                                                            <CardTitle className="text-base font-medium">
                                                                {insight.whatChanged || alert.diff_summary}
                                                            </CardTitle>
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                                <CardContent>
                                                    {insight.whyItMatters && (
                                                        <p className="text-sm text-muted-foreground mb-2">
                                                            {insight.whyItMatters}
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-muted-foreground">
                                                        {formatRelativeTime(alert.created_at)}
                                                    </p>
                                                </CardContent>
                                            </Card>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
