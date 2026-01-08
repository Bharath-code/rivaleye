"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    ExternalLink,
    RefreshCw,
    Loader2,
    DollarSign,
    Palette,
    Code,
    Gauge,
    AlertCircle,
    Clock,
    TrendingUp,
    CheckCircle2,
} from "lucide-react";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

interface CompetitorDetails {
    competitor: {
        id: string;
        name: string;
        url: string;
        status: string;
        last_checked_at: string | null;
    };
    analysis: {
        data: any;
        timestamp: string | null;
        hasChanges: boolean;
    };
    pricing: {
        current: any;
        history: any[];
    };
    branding: {
        tagline: string | null;
        positioning: any;
        socialProof: string[];
    };
    techStack: {
        integrations: string[];
        security: string[];
    };
    performance: {
        data: any;
    };
    alerts: any[];
}

export default function CompetitorDetailPage() {
    const params = useParams();
    const router = useRouter();
    const competitorId = params.id as string;

    const [data, setData] = useState<CompetitorDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchDetails();
    }, [competitorId]);

    const fetchDetails = async () => {
        try {
            const res = await fetch(`/api/competitors/${competitorId}/details`);
            const json = await res.json();

            if (!res.ok) throw new Error(json.error);
            setData(json);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load");
        } finally {
            setIsLoading(false);
        }
    };

    const runAnalysis = async () => {
        setIsAnalyzing(true);
        try {
            const res = await fetch("/api/analyze-competitor", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ competitorId }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);

            // Refresh data after analysis
            await fetchDetails();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Analysis failed");
        } finally {
            setIsAnalyzing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                </main>
                <Footer />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex-1 flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                        <p className="text-muted-foreground">{error || "Not found"}</p>
                        <Button variant="outline" className="mt-4" onClick={() => router.push("/dashboard")}>
                            Back to Dashboard
                        </Button>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    const { competitor, analysis, pricing, branding, techStack, alerts } = data;
    const analysisData = analysis.data;

    return (
        <div className="flex-1 flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 pt-24 pb-12 px-6">
                <div className="container max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <Link
                            href="/dashboard"
                            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Dashboard
                        </Link>

                        <div className="flex items-start justify-between">
                            <div>
                                <h1 className="font-display text-3xl text-foreground">{competitor.name}</h1>
                                <a
                                    href={competitor.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-muted-foreground hover:text-emerald-400 flex items-center gap-1 mt-1"
                                >
                                    {competitor.url}
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>

                            <Button
                                onClick={runAnalysis}
                                disabled={isAnalyzing}
                                className="glow-emerald gap-2"
                            >
                                {isAnalyzing ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="w-4 h-4" />
                                )}
                                {isAnalyzing ? "Analyzing..." : "Scan Now"}
                            </Button>
                        </div>

                        {analysis.timestamp && (
                            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Last analyzed: {new Date(analysis.timestamp).toLocaleString()}
                            </p>
                        )}
                    </div>

                    {/* Dashboard Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Pricing Section */}
                        <Card className="glass-card">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                        <DollarSign className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">Pricing</CardTitle>
                                        <CardDescription>Plans & pricing structure</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {pricing.current?.plans?.length > 0 ? (
                                    <div className="space-y-3">
                                        {pricing.current.plans.map((plan: any, idx: number) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50"
                                            >
                                                <div>
                                                    <p className="font-medium text-foreground">{plan.name}</p>
                                                    {plan.highlight && (
                                                        <Badge variant="secondary" className="text-xs mt-1">
                                                            {plan.highlight}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-semibold text-emerald-400">{plan.price}</p>
                                                    <p className="text-xs text-muted-foreground">{plan.period}</p>
                                                </div>
                                            </div>
                                        ))}
                                        {pricing.current.billingOptions?.length > 1 && (
                                            <p className="text-xs text-muted-foreground">
                                                Billing: {pricing.current.billingOptions.join(", ")}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-sm">No pricing data yet. Run a scan.</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Branding Section */}
                        <Card className="glass-card">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                        <Palette className="w-5 h-5 text-purple-400" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">Branding & Positioning</CardTitle>
                                        <CardDescription>Identity & messaging</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {branding.tagline && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Tagline</p>
                                        <p className="text-foreground italic">"{branding.tagline}"</p>
                                    </div>
                                )}
                                {branding.positioning?.valueProposition && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Value Proposition</p>
                                        <p className="text-foreground text-sm">{branding.positioning.valueProposition}</p>
                                    </div>
                                )}
                                {branding.positioning?.targetAudience && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Target Audience</p>
                                        <p className="text-foreground text-sm">{branding.positioning.targetAudience}</p>
                                    </div>
                                )}
                                {branding.socialProof?.length > 0 && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-2">Social Proof</p>
                                        <div className="flex flex-wrap gap-2">
                                            {branding.socialProof.slice(0, 5).map((proof: string, idx: number) => (
                                                <Badge key={idx} variant="outline" className="text-xs">
                                                    {proof}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {!branding.tagline && !branding.positioning && (
                                    <p className="text-muted-foreground text-sm">No branding data yet.</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Tech Stack Section */}
                        <Card className="glass-card">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                        <Code className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">Tech Stack</CardTitle>
                                        <CardDescription>Integrations & security</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {techStack.integrations?.length > 0 && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-2">Integrations</p>
                                        <div className="flex flex-wrap gap-2">
                                            {techStack.integrations.map((integration: string, idx: number) => (
                                                <Badge key={idx} variant="secondary" className="text-xs">
                                                    {integration}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {techStack.security?.length > 0 && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-2">Security & Compliance</p>
                                        <div className="flex flex-wrap gap-2">
                                            {techStack.security.map((cert: string, idx: number) => (
                                                <Badge key={idx} className="text-xs bg-green-500/10 text-green-400 border-green-500/30">
                                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                                    {cert}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {!techStack.integrations?.length && !techStack.security?.length && (
                                    <p className="text-muted-foreground text-sm">No tech stack data yet.</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Performance Section */}
                        <Card className="glass-card">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                        <Gauge className="w-5 h-5 text-orange-400" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">Performance</CardTitle>
                                        <CardDescription>Web Vitals & speed</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground text-sm">
                                    Core Web Vitals coming soon.
                                </p>
                                {/* TODO: Add performance metrics when PSI integration is complete */}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Key Insights */}
                    {analysisData?.insights?.length > 0 && (
                        <Card className="glass-card mt-6">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                                        <TrendingUp className="w-5 h-5 text-yellow-400" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">Key Insights</CardTitle>
                                        <CardDescription>AI-generated competitive intelligence</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2">
                                    {analysisData.insights.map((insight: string, idx: number) => (
                                        <li key={idx} className="flex items-start gap-2 text-sm text-foreground">
                                            <span className="text-emerald-400 mt-1">•</span>
                                            {insight}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}

                    {/* Summary */}
                    {analysisData?.summary && (
                        <Card className="glass-card mt-6">
                            <CardHeader>
                                <CardTitle className="text-lg">Executive Summary</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-foreground">{analysisData.summary}</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
}
