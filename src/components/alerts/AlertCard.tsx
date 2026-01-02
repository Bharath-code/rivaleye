"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PricingDiffType, AlertSeverity } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Alert Card Component
 *
 * Trust-first design: shows evidence, confidence, and clear actions.
 */

interface AlertCardProps {
    id: string;
    competitorName: string;
    alertType: PricingDiffType;
    severity: AlertSeverity;
    title: string;
    beforeValue: string | null;
    afterValue: string | null;
    aiExplanation?: string;
    confidence?: "high" | "medium" | "low";
    region: string;
    createdAt: string;
    isRead?: boolean;
    onViewDetails?: (id: string) => void;
    onDismiss?: (id: string) => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// SEVERITY CONFIG
// ══════════════════════════════════════════════════════════════════════════════

const severityConfig = {
    high: {
        bg: "bg-red-50 dark:bg-red-950/20",
        border: "border-red-200 dark:border-red-800",
        badge: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
        dot: "bg-red-500",
    },
    medium: {
        bg: "bg-amber-50 dark:bg-amber-950/20",
        border: "border-amber-200 dark:border-amber-800",
        badge: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
        dot: "bg-amber-500",
    },
    low: {
        bg: "bg-emerald-50 dark:bg-emerald-950/20",
        border: "border-emerald-200 dark:border-emerald-800",
        badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
        dot: "bg-emerald-500",
    },
};

const alertTypeEmoji: Record<PricingDiffType, string> = {
    price_increase: "📈",
    price_decrease: "📉",
    plan_added: "➕",
    plan_removed: "➖",
    free_tier_removed: "🚨",
    free_tier_added: "🎁",
    plan_promoted: "⭐",
    cta_changed: "🔄",
    regional_difference: "🌍",
};

const alertTypeLabel: Record<PricingDiffType, string> = {
    price_increase: "Price Increase",
    price_decrease: "Price Decrease",
    plan_added: "New Plan",
    plan_removed: "Plan Removed",
    free_tier_removed: "Free Tier Removed",
    free_tier_added: "Free Tier Added",
    plan_promoted: "Plan Promoted",
    cta_changed: "CTA Changed",
    regional_difference: "Regional Difference",
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export function AlertCard({
    id,
    competitorName,
    alertType,
    severity,
    title,
    beforeValue,
    afterValue,
    aiExplanation,
    confidence = "medium",
    region,
    createdAt,
    isRead = false,
    onViewDetails,
    onDismiss,
}: AlertCardProps) {
    const config = severityConfig[severity];
    const emoji = alertTypeEmoji[alertType];
    const typeLabel = alertTypeLabel[alertType];

    const timeAgo = getTimeAgo(new Date(createdAt));

    return (
        <Card
            className={cn(
                "relative overflow-hidden transition-all duration-200",
                config.bg,
                config.border,
                !isRead && "ring-2 ring-offset-2 ring-offset-background",
                !isRead && severity === "high" && "ring-red-300",
                !isRead && severity === "medium" && "ring-amber-300",
                !isRead && severity === "low" && "ring-emerald-300",
                isRead && "opacity-75"
            )}
        >
            {/* Unread indicator */}
            {!isRead && (
                <div className={cn("absolute top-4 right-4 w-2 h-2 rounded-full", config.dot)} />
            )}

            <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        {/* Type & Severity */}
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className={config.badge}>
                                {emoji} {typeLabel}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                                {severity.toUpperCase()}
                            </Badge>
                        </div>

                        {/* Title */}
                        <CardTitle className="text-lg leading-tight">{title}</CardTitle>

                        {/* Meta */}
                        <CardDescription className="flex items-center gap-2 text-xs">
                            <span>{competitorName}</span>
                            <span>·</span>
                            <span>📍 {region.toUpperCase()}</span>
                            <span>·</span>
                            <span>{timeAgo}</span>
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Before → After */}
                <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                    <div className="flex-1">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                            Before
                        </div>
                        <div className="font-medium text-sm">{beforeValue || "—"}</div>
                    </div>
                    <div className="text-muted-foreground">→</div>
                    <div className="flex-1">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                            After
                        </div>
                        <div className="font-medium text-sm text-foreground">{afterValue || "—"}</div>
                    </div>
                </div>

                {/* AI Insight */}
                {aiExplanation && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 mb-1">
                            <span>💡 Why It Matters</span>
                            <ConfidenceBadge confidence={confidence} />
                        </div>
                        <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                            {aiExplanation}
                        </p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                    <Button
                        variant="default"
                        size="sm"
                        onClick={() => onViewDetails?.(id)}
                        className="flex-1"
                    >
                        View Details
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDismiss?.(id)}
                        className="text-muted-foreground"
                    >
                        Dismiss
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// CONFIDENCE BADGE
// ══════════════════════════════════════════════════════════════════════════════

function ConfidenceBadge({ confidence }: { confidence: "high" | "medium" | "low" }) {
    const config = {
        high: { text: "High confidence", color: "text-emerald-600 dark:text-emerald-400" },
        medium: { text: "Medium confidence", color: "text-amber-600 dark:text-amber-400" },
        low: { text: "Low confidence", color: "text-red-600 dark:text-red-400" },
    };

    return (
        <span className={cn("text-[10px] uppercase tracking-wider", config[confidence].color)}>
            ({config[confidence].text})
        </span>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function getTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    return date.toLocaleDateString();
}

export default AlertCard;
