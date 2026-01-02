"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    ArrowRight,
    Bell,
    ChevronDown,
    ChevronUp,
    Copy,
    Check,
    Slack,
    ExternalLink,
} from "lucide-react";

interface DemoAlertPreviewProps {
    variant?: "basic" | "tactical";
}

// Mock data for the demo alert
const DEMO_ALERT = {
    competitorName: "Acme Corp",
    alertType: "price_increase",
    severity: "high",
    headline: "Acme Corp raised Pro plan from $49 → $79/mo",
    region: "US",
    beforeValue: "$49/mo",
    afterValue: "$79/mo",
    percentChange: "+61%",
    aiExplanation: "This 61% increase signals Acme is moving upmarket. They're conceding price-sensitive customers to focus on enterprise deals. This creates a window to capture their churning SMB segment.",
    tacticalPlaybook: {
        salesResponse: "Subject: Quick question about your Acme subscription\n\nHi [Name],\n\nI noticed Acme just increased their Pro pricing by 61%. Many of their customers are looking for alternatives that deliver the same value without the premium markup.\n\nWould you be open to a quick chat about how we compare? I can share a side-by-side analysis.\n\nBest,\n[Your Name]",
        productPivots: [
            "Launch 'Acme Migration' landing page this week",
            "Create comparison table emphasizing our lower TCO",
            "Offer 20% discount for verified Acme customers",
        ],
        marketingAngles: [
            "\"Same features, half the price\" campaign",
            "Target Acme users in retargeting ads",
            "Publish blog: '5 Acme Alternatives in 2025'",
        ],
    },
};

export function DemoAlertPreview({ variant = "tactical" }: DemoAlertPreviewProps) {
    const [isExpanded, setIsExpanded] = useState(variant === "tactical");
    const [copiedSales, setCopiedSales] = useState(false);

    const handleCopySalesScript = () => {
        navigator.clipboard.writeText(DEMO_ALERT.tacticalPlaybook.salesResponse);
        setCopiedSales(true);
        setTimeout(() => setCopiedSales(false), 2000);
    };

    return (
        <Card className="glass-card border-red-500/30 overflow-hidden">
            {/* Header */}
            <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                            <Bell className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Badge variant="destructive" className="text-[10px] px-2">
                                    {DEMO_ALERT.severity.toUpperCase()} PRIORITY
                                </Badge>
                                <span className="text-xs text-muted-foreground">📍 {DEMO_ALERT.region}</span>
                            </div>
                            <CardTitle className="text-base font-medium">
                                📈 {DEMO_ALERT.headline}
                            </CardTitle>
                        </div>
                    </div>
                    <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px]">
                        DEMO
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Before/After Box */}
                <div className="bg-muted/30 rounded-xl p-4 border border-border">
                    <div className="grid grid-cols-3 gap-4 items-center">
                        <div className="text-center">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Before</div>
                            <div className="text-xl font-mono text-foreground">{DEMO_ALERT.beforeValue}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl text-emerald-400">→</div>
                            <div className="text-xs text-red-400 font-medium">{DEMO_ALERT.percentChange}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-[10px] text-emerald-400 uppercase tracking-wider mb-1">After</div>
                            <div className="text-xl font-mono text-emerald-400 font-bold">{DEMO_ALERT.afterValue}</div>
                        </div>
                    </div>
                </div>

                {/* AI Insight */}
                <div className="bg-emerald-500/5 rounded-xl p-4 border border-emerald-500/20">
                    <div className="text-xs text-emerald-400 font-medium mb-2">💡 Why It Matters</div>
                    <p className="text-sm text-foreground leading-relaxed">
                        {DEMO_ALERT.aiExplanation}
                    </p>
                </div>

                {/* Tactical Brief (Expandable) */}
                {variant === "tactical" && (
                    <div className="border border-border rounded-xl overflow-hidden">
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="w-full px-4 py-3 flex items-center justify-between bg-muted/20 hover:bg-muted/30 transition-colors"
                        >
                            <span className="text-sm font-medium text-foreground flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-[10px]">🎯</span>
                                Tactical Response Brief
                            </span>
                            {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                        </button>

                        {isExpanded && (
                            <div className="p-4 space-y-4 border-t border-border">
                                {/* Sales Script */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            📧 Sales Response Draft
                                        </h4>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs gap-1"
                                            onClick={handleCopySalesScript}
                                        >
                                            {copiedSales ? (
                                                <>
                                                    <Check className="w-3 h-3" />
                                                    Copied
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-3 h-3" />
                                                    Copy
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                    <pre className="bg-muted/20 rounded-lg p-3 text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                                        {DEMO_ALERT.tacticalPlaybook.salesResponse}
                                    </pre>
                                </div>

                                {/* Product Pivots */}
                                <div>
                                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                                        🔧 Product Pivots
                                    </h4>
                                    <ul className="space-y-1.5">
                                        {DEMO_ALERT.tacticalPlaybook.productPivots.map((pivot, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                                                <span className="text-emerald-400 mt-0.5">→</span>
                                                {pivot}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Marketing Angles */}
                                <div>
                                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                                        📣 Marketing Angles
                                    </h4>
                                    <ul className="space-y-1.5">
                                        {DEMO_ALERT.tacticalPlaybook.marketingAngles.map((angle, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                                                <span className="text-amber-400 mt-0.5">→</span>
                                                {angle}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* CTA Buttons */}
                                <div className="flex gap-2 pt-2">
                                    <Button variant="outline" size="sm" className="flex-1 gap-2 text-xs" disabled>
                                        <Slack className="w-3 h-3" />
                                        Push to Slack
                                    </Button>
                                    <Button variant="outline" size="sm" className="flex-1 gap-2 text-xs" disabled>
                                        <ExternalLink className="w-3 h-3" />
                                        View Full Alert
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* CTA */}
                <div className="text-center pt-2">
                    <Button className="glow-emerald gap-2" asChild>
                        <a href="/login">
                            Start Monitoring Free
                            <ArrowRight className="w-4 h-4" />
                        </a>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export default DemoAlertPreview;
