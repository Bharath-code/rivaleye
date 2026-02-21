"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Analysis result modal — shows AI vision analysis of a competitor page.
 * Extracted from dashboard page for reusability and maintainability.
 */

interface AnalysisResult {
    companyName?: string;
    tagline?: string;
    pricing?: {
        plans?: Array<{
            name: string;
            price: string;
            period?: string;
            credits?: string;
            features?: string[];
        }>;
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
}

interface AnalysisResultModalProps {
    result: AnalysisResult | null;
    onClose: () => void;
}

export function AnalysisResultModal({ result, onClose }: AnalysisResultModalProps) {
    if (!result) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="glass-card max-w-2xl w-full max-h-[80vh] overflow-auto">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <span>🔍</span>
                        AI Analysis: {result.companyName}
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        ✕
                    </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Executive Summary */}
                    {result.summary && (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                            <p className="text-sm text-foreground">{result.summary}</p>
                        </div>
                    )}

                    {/* Tagline */}
                    {result.tagline && (
                        <p className="text-muted-foreground italic">&quot;{result.tagline}&quot;</p>
                    )}

                    {/* Pricing Plans */}
                    {result.pricing?.plans && result.pricing.plans.length > 0 && (
                        <div>
                            <h3 className="font-semibold mb-3 text-foreground">💰 Pricing Plans</h3>
                            <div className="grid gap-3">
                                {result.pricing.plans.map((plan, i) => (
                                    <div key={i} className="border border-border/50 rounded-lg p-3 bg-surface-elevated/50">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-medium text-foreground">{plan.name}</span>
                                            <span className="text-emerald-400 font-bold">
                                                {plan.price}{plan.period ? `/${plan.period}` : ""}
                                            </span>
                                        </div>
                                        {plan.credits && (
                                            <p className="text-sm text-muted-foreground">{plan.credits}</p>
                                        )}
                                        {plan.features && plan.features.length > 0 && (
                                            <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                                                {plan.features.slice(0, 4).map((f, j) => (
                                                    <li key={j}>• {f}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {result.pricing.promotions && result.pricing.promotions.length > 0 && (
                                <div className="mt-3 text-sm text-amber-400">
                                    🎁 {result.pricing.promotions.join(" • ")}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Features */}
                    {result.features?.highlighted && result.features.highlighted.length > 0 && (
                        <div>
                            <h3 className="font-semibold mb-3 text-foreground">✨ Key Features</h3>
                            <div className="flex flex-wrap gap-2">
                                {result.features.highlighted.map((f, i) => (
                                    <span key={i} className="px-2 py-1 bg-surface-elevated text-xs rounded-full text-muted-foreground">
                                        {f}
                                    </span>
                                ))}
                            </div>
                            {result.features.differentiators && result.features.differentiators.length > 0 && (
                                <div className="mt-3">
                                    <p className="text-xs text-muted-foreground mb-1">Differentiators:</p>
                                    <ul className="text-sm text-foreground space-y-1">
                                        {result.features.differentiators.map((d, i) => (
                                            <li key={i}>→ {d}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Target Audience */}
                    {result.positioning?.targetAudience && (
                        <div>
                            <h3 className="font-semibold mb-2 text-foreground">🎯 Target Audience</h3>
                            <p className="text-sm text-muted-foreground">{result.positioning.targetAudience}</p>
                            {result.positioning.valueProposition && (
                                <p className="text-sm text-emerald-400 mt-2">&quot;{result.positioning.valueProposition}&quot;</p>
                            )}
                        </div>
                    )}

                    {/* Social Proof */}
                    {result.positioning?.socialProof && result.positioning.socialProof.length > 0 && (
                        <div>
                            <h3 className="font-semibold mb-2 text-foreground">🏆 Social Proof</h3>
                            <div className="flex flex-wrap gap-2">
                                {result.positioning.socialProof.map((s, i) => (
                                    <span key={i} className="px-2 py-1 bg-amber-500/10 text-xs rounded-full text-amber-400">
                                        {s}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Key Insights */}
                    {result.insights && result.insights.length > 0 && (
                        <div>
                            <h3 className="font-semibold mb-3 text-foreground">💡 Key Insights</h3>
                            <ul className="space-y-2">
                                {result.insights.map((insight, i) => (
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
    );
}
