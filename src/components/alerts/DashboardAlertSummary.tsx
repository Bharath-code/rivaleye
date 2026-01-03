"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import type { PricingDiffType, AlertSeverity } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Compact Alert Card for Dashboard
 * 
 * Minimal version of AlertCard for dashboard summary view.
 */

interface CompactAlertCardProps {
    id: string;
    competitorName: string;
    alertType: PricingDiffType;
    severity: AlertSeverity;
    title: string;
    createdAt: string;
    isRead?: boolean;
    onClick?: () => void;
}

const severityConfig = {
    high: {
        border: "border-l-red-500",
        badge: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
        dot: "bg-red-500",
    },
    medium: {
        border: "border-l-amber-500",
        badge: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
        dot: "bg-amber-500",
    },
    low: {
        border: "border-l-emerald-500",
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

function getTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
}

export function CompactAlertCard({
    id,
    competitorName,
    alertType,
    severity,
    title,
    createdAt,
    isRead = false,
    onClick,
}: CompactAlertCardProps) {
    const config = severityConfig[severity];
    const emoji = alertTypeEmoji[alertType];

    return (
        <Card
            className={cn(
                "relative border-l-4 transition-all duration-300 cursor-pointer hover:bg-white/[0.04] hover:translate-x-0.5 active:scale-[0.99]",
                config.border,
                !isRead ? "bg-emerald-500/[0.03] border-border/50" : "bg-transparent opacity-80"
            )}
            onClick={onClick}
        >
            <CardContent className="py-3.5 px-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                            {!isRead && (
                                <div className={cn("w-2 h-2 rounded-full shrink-0 animate-pulse", config.dot)} />
                            )}
                            <Badge variant="outline" className={cn("text-[11px] px-2 font-mono tracking-tight", config.badge)}>
                                {emoji} {severity.toUpperCase()}
                            </Badge>
                            <span className="text-[11px] font-bold text-foreground/70 uppercase tracking-widest truncate">
                                {competitorName}
                            </span>
                        </div>
                        <p className="text-[13px] font-medium text-foreground leading-relaxed truncate">{title}</p>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0 mt-1">
                        {getTimeAgo(new Date(createdAt))}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Dashboard Alert Summary
 * 
 * Quick summary of recent alerts for the dashboard sidebar.
 */

interface DashboardAlertSummaryProps {
    alerts: Array<{
        id: string;
        competitor_name?: string;
        type: PricingDiffType;
        severity: AlertSeverity;
        title: string;
        is_read?: boolean;
        created_at: string;
        competitors?: { name: string };
    }>;
    onViewAlert?: (id: string) => void;
    onViewAll?: () => void;
}

export function DashboardAlertSummary({
    alerts,
    onViewAlert,
    onViewAll,
}: DashboardAlertSummaryProps) {
    const unreadCount = alerts.filter((a) => !a.is_read).length;
    const highPriorityCount = alerts.filter((a) => a.severity === "high").length;

    // Show max 5 alerts
    const displayAlerts = alerts.slice(0, 5);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-mono text-sm text-muted-foreground uppercase tracking-wider">
                        Pricing Alerts
                    </h2>
                    {unreadCount > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium text-foreground">{unreadCount}</span> unread
                            {highPriorityCount > 0 && (
                                <span className="text-red-500 ml-1">
                                    ({highPriorityCount} urgent)
                                </span>
                            )}
                        </p>
                    )}
                </div>
                {alerts.length > 5 && (
                    <Button variant="ghost" size="sm" onClick={onViewAll}>
                        View All →
                    </Button>
                )}
            </div>

            {/* Alert List */}
            {displayAlerts.length > 0 ? (
                <div className="space-y-2">
                    {displayAlerts.map((alert) => (
                        <CompactAlertCard
                            key={alert.id}
                            id={alert.id}
                            competitorName={alert.competitor_name || alert.competitors?.name || "Unknown"}
                            alertType={alert.type}
                            severity={alert.severity}
                            title={alert.title}
                            createdAt={alert.created_at}
                            isRead={alert.is_read}
                            onClick={() => onViewAlert?.(alert.id)}
                        />
                    ))}
                </div>
            ) : (
                <Card className="glass-card shadow-none border-dashed bg-transparent">
                    <CardContent className="py-12 text-center relative overflow-hidden">
                        {/* Architectural Background Pattern */}
                        <div className="absolute inset-0 pointer-events-none opacity-20">
                            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                                <defs>
                                    <pattern id="dotGridSmall" width="10" height="10" patternUnits="userSpaceOnUse">
                                        <circle cx="1" cy="1" r="0.5" fill="currentColor" className="text-muted-foreground" />
                                    </pattern>
                                </defs>
                                <rect width="100%" height="100%" fill="url(#dotGridSmall)" />
                            </svg>
                        </div>

                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-full bg-muted/30 border border-muted flex items-center justify-center mx-auto mb-4">
                                <Bell className="w-5 h-5 text-muted-foreground/50" />
                            </div>
                            <h3 className="text-sm font-medium text-foreground mb-1">Silence is Strategic</h3>
                            <p className="text-xs text-muted-foreground max-w-[200px] mx-auto leading-relaxed">
                                No new movements detected yet. We&apos;ll notify you the moment a competitor shifts their strategy.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* View All Button */}
            {alerts.length > 0 && (
                <Button variant="outline" className="w-full border-white/5 bg-white/[0.02] text-white/70 hover:bg-emerald-500 hover:text-black hover:border-emerald-500 transition-all duration-300 h-10 font-medium" onClick={onViewAll}>
                    View All Alerts ({alerts.length})
                </Button>
            )}
        </div>
    );
}

export default DashboardAlertSummary;
