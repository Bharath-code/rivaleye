"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { DisclaimerFooter } from "./AlertList";
import type { PricingDiffType, AlertSeverity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CompetitiveResponseBrief } from "./CompetitiveResponseBrief";
import { analytics } from "@/components/providers/AnalyticsProvider";

/**
 * Alert Detail View
 *
 * Full alert details with side-by-side screenshots, complete AI insight,
 * and suppression/preference settings.
 */

interface AlertDetailViewProps {
    alert: {
        id: string;
        competitor_name: string;
        type: PricingDiffType;
        severity: AlertSeverity;
        title: string;
        description: string;
        details: {
            context?: string;
            before?: string | null;
            after?: string | null;
            aiExplanation?: string;
            tacticalPlaybook?: {
                salesDraft?: string;
                productPivot?: string;
                marketingAngle?: string;
            };
            screenshotPath?: string | null;
            screenshotUrl?: string | null;
            previousScreenshotUrl?: string | null;
        };
        is_read: boolean;
        created_at: string;
    };
    onBack?: () => void;
    onSuppressType?: (type: PricingDiffType) => void;
    onVerifyOnSite?: () => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// SEVERITY CONFIG
// ══════════════════════════════════════════════════════════════════════════════

const severityConfig = {
    high: {
        bg: "bg-red-50 dark:bg-red-950/20",
        border: "border-red-200 dark:border-red-800",
        badge: "bg-red-100 text-red-700",
        label: "High Priority",
        icon: "🚨",
    },
    medium: {
        bg: "bg-amber-50 dark:bg-amber-950/20",
        border: "border-amber-200 dark:border-amber-800",
        badge: "bg-amber-100 text-amber-700",
        label: "Medium Priority",
        icon: "⚠️",
    },
    low: {
        bg: "bg-emerald-50 dark:bg-emerald-950/20",
        border: "border-emerald-200 dark:border-emerald-800",
        badge: "bg-emerald-100 text-emerald-700",
        label: "Low Priority",
        icon: "ℹ️",
    },
};

const alertTypeLabels: Record<PricingDiffType, { label: string; emoji: string }> = {
    price_increase: { label: "Price Increase", emoji: "📈" },
    price_decrease: { label: "Price Decrease", emoji: "📉" },
    plan_added: { label: "New Plan Added", emoji: "➕" },
    plan_removed: { label: "Plan Removed", emoji: "➖" },
    free_tier_removed: { label: "Free Tier Removed", emoji: "🚨" },
    free_tier_added: { label: "Free Tier Added", emoji: "🎁" },
    plan_promoted: { label: "Plan Promoted", emoji: "⭐" },
    cta_changed: { label: "CTA Changed", emoji: "🔄" },
    regional_difference: { label: "Regional Difference", emoji: "🌍" },
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export function AlertDetailView({
    alert,
    onBack,
    onSuppressType,
    onVerifyOnSite,
}: AlertDetailViewProps) {
    const config = severityConfig[alert.severity];
    const typeInfo = alertTypeLabels[alert.type];
    const hasScreenshots = alert.details.screenshotUrl || alert.details.previousScreenshotUrl;

    // Track alert view on mount
    useEffect(() => {
        analytics.alertViewed(alert.id, alert.severity);
        if (hasScreenshots) {
            analytics.screenshotViewed();
        }
    }, [alert.id, alert.severity, hasScreenshots]);

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Back Button */}
            <Button variant="ghost" size="sm" onClick={onBack} className="mb-4">
                ← Back to Alerts
            </Button>

            {/* Header Card */}
            <Card className={cn(config.bg, config.border)}>
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Badge className={config.badge}>
                                    {config.icon} {config.label}
                                </Badge>
                                <Badge variant="outline">
                                    {typeInfo.emoji} {typeInfo.label}
                                </Badge>
                            </div>
                            <CardTitle className="text-2xl">{alert.title}</CardTitle>
                            <CardDescription className="flex items-center gap-2">
                                <span className="font-medium">{alert.competitor_name}</span>
                                <span>·</span>
                                <span>📍 {alert.details.context?.toUpperCase() || "GLOBAL"}</span>
                                <span>·</span>
                                <span>{new Date(alert.created_at).toLocaleString()}</span>
                            </CardDescription>
                        </div>

                        <Button variant="default" onClick={onVerifyOnSite}>
                            Verify on Site →
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            {/* Before/After Comparison */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">📊 Change Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                Before
                            </div>
                            <div className="p-4 bg-muted/50 rounded-lg min-h-[60px]">
                                <span className="text-lg font-medium">
                                    {alert.details.before || "—"}
                                </span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="text-sm font-medium text-emerald-600 uppercase tracking-wider">
                                After
                            </div>
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg min-h-[60px]">
                                <span className="text-lg font-medium text-emerald-700 dark:text-emerald-300">
                                    {alert.details.after || "—"}
                                </span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Side-by-Side Screenshots */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">📸 Visual Evidence</CardTitle>
                    <CardDescription>
                        Screenshots captured at time of detection
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {hasScreenshots ? (
                        <div className="grid grid-cols-2 gap-4">
                            {alert.details.previousScreenshotUrl && (
                                <div className="space-y-2">
                                    <div className="text-sm font-medium text-muted-foreground">
                                        Before
                                    </div>
                                    <div className="relative aspect-[4/3] rounded-lg overflow-hidden border bg-muted">
                                        <Image
                                            src={alert.details.previousScreenshotUrl || "/placeholder-screenshot.png"}
                                            alt="Before screenshot"
                                            fill
                                            className="object-cover object-top"
                                        />
                                    </div>
                                </div>
                            )}
                            {alert.details.screenshotUrl && (
                                <div className="space-y-2">
                                    <div className="text-sm font-medium text-emerald-600">
                                        After
                                    </div>
                                    <div className="relative aspect-[4/3] rounded-lg overflow-hidden border-2 border-emerald-300 bg-muted">
                                        <Image
                                            src={alert.details.screenshotUrl}
                                            alt="After screenshot"
                                            fill
                                            className="object-cover object-top"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="py-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-border rounded-lg bg-muted/20">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                                <Sparkles className="w-6 h-6 text-emerald-400" />
                            </div>
                            <h4 className="font-medium text-foreground">Unlock Visual Evidence</h4>
                            <p className="text-sm text-muted-foreground max-w-xs mt-2 mb-6">
                                Side-by-side screenshots are captured automatically for Pro users.
                            </p>
                            <Button size="sm" className="glow-emerald" onClick={() => window.open("/#pricing", "_blank")}>
                                Upgrade to Pro
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* AI Insight */}
            <Card className={cn(
                alert.details.aiExplanation ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" : "bg-muted/10 border-dashed border-2"
            )}>
                <CardHeader>
                    <CardTitle className={cn("text-lg", alert.details.aiExplanation && "text-blue-800 dark:text-blue-200")}>
                        💡 {alert.details.aiExplanation ? "AI Analysis" : "Unlock AI Insights"}
                    </CardTitle>
                    <CardDescription className={cn(alert.details.aiExplanation && "text-blue-600 dark:text-blue-400")}>
                        {alert.details.aiExplanation ? "Generated explanation with medium confidence" : "Get expert context on why this change matters."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {alert.details.aiExplanation ? (
                        <p className="text-blue-800 dark:text-blue-200 leading-relaxed">
                            {alert.details.aiExplanation}
                        </p>
                    ) : (
                        <div className="py-6 space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Stop guessing. Our AI analyzes competitor moves to tell you if they&apos;re moving upmarket, testing elasticities, or preparing for a shift.
                            </p>
                            <Button size="sm" variant="outline" className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10 gap-2" onClick={() => window.open("/#pricing", "_blank")}>
                                <Sparkles className="w-4 h-4" />
                                Upgrade to Pro
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Tactical Playbook (Pro Only) */}
            <CompetitiveResponseBrief
                alertId={alert.id}
                playbook={alert.details.tacticalPlaybook || {}}
                competitorName={alert.competitor_name}
                isPro={!!alert.details.aiExplanation}
            />

            {/* Alert Preferences */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">⚙️ Alert Preferences</CardTitle>
                    <CardDescription>
                        Customize how you receive alerts for this type
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                        <div>
                            <div className="font-medium">Suppress {typeInfo.label} alerts</div>
                            <div className="text-sm text-muted-foreground">
                                Stop receiving alerts for this change type
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onSuppressType?.(alert.type)}
                        >
                            Suppress
                        </Button>
                    </div>

                    <Separator />

                    <div className="text-xs text-muted-foreground">
                        You can manage all suppression rules in{" "}
                        <a href="/settings/alerts" className="underline hover:text-foreground">
                            Settings → Alerts
                        </a>
                    </div>
                </CardContent>
            </Card>

            {/* Disclaimer */}
            <DisclaimerFooter />
        </div>
    );
}

export default AlertDetailView;
