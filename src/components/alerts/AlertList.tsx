"use client";

import React, { useState } from "react";
import { AlertCard } from "./AlertCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { PricingDiffType, AlertSeverity } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Alert List Component
 *
 * Dashboard-style list of pricing alerts with filtering and sorting.
 */

interface AlertData {
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
    };
    is_read: boolean;
    created_at: string;
}

interface AlertListProps {
    alerts: AlertData[];
    onViewDetails?: (id: string) => void;
    onDismiss?: (id: string) => void;
    onMarkAllRead?: () => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export function AlertList({
    alerts,
    onViewDetails,
    onDismiss,
    onMarkAllRead,
}: AlertListProps) {
    const [filter, setFilter] = useState<AlertSeverity | "all">("all");
    const [sortBy, setSortBy] = useState<"date" | "severity">("date");

    // Filter alerts
    const filteredAlerts = alerts.filter((alert) => {
        if (filter === "all") return true;
        return alert.severity === filter;
    });

    // Sort alerts
    const sortedAlerts = [...filteredAlerts].sort((a, b) => {
        if (sortBy === "severity") {
            const severityOrder = { high: 0, medium: 1, low: 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const unreadCount = alerts.filter((a) => !a.is_read).length;
    const highCount = alerts.filter((a) => a.severity === "high").length;
    const mediumCount = alerts.filter((a) => a.severity === "medium").length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">Pricing Alerts</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        {unreadCount > 0 ? (
                            <>
                                <span className="font-medium text-foreground">{unreadCount}</span> unread
                                {highCount > 0 && (
                                    <span className="text-red-600 ml-2">
                                        ({highCount} high priority)
                                    </span>
                                )}
                            </>
                        ) : (
                            "All caught up!"
                        )}
                    </p>
                </div>

                {unreadCount > 0 && (
                    <Button variant="outline" size="sm" onClick={onMarkAllRead}>
                        Mark all as read
                    </Button>
                )}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Filter:</span>
                    <div className="flex gap-1">
                        <FilterButton
                            active={filter === "all"}
                            onClick={() => setFilter("all")}
                            count={alerts.length}
                        >
                            All
                        </FilterButton>
                        <FilterButton
                            active={filter === "high"}
                            onClick={() => setFilter("high")}
                            count={highCount}
                            variant="high"
                        >
                            High
                        </FilterButton>
                        <FilterButton
                            active={filter === "medium"}
                            onClick={() => setFilter("medium")}
                            count={mediumCount}
                            variant="medium"
                        >
                            Medium
                        </FilterButton>
                    </div>
                </div>

                <Separator orientation="vertical" className="h-6" />

                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Sort:</span>
                    <Button
                        variant={sortBy === "date" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setSortBy("date")}
                    >
                        Recent
                    </Button>
                    <Button
                        variant={sortBy === "severity" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setSortBy("severity")}
                    >
                        Priority
                    </Button>
                </div>
            </div>

            {/* Alert Cards */}
            {sortedAlerts.length > 0 ? (
                <div className="grid gap-4">
                    {sortedAlerts.map((alert) => (
                        <AlertCard
                            key={alert.id}
                            id={alert.id}
                            competitorName={alert.competitor_name}
                            alertType={alert.type}
                            severity={alert.severity}
                            title={alert.title}
                            beforeValue={alert.details?.before || null}
                            afterValue={alert.details?.after || null}
                            aiExplanation={alert.details?.aiExplanation}
                            region={alert.details?.context || "global"}
                            createdAt={alert.created_at}
                            isRead={alert.is_read}
                            onViewDetails={onViewDetails}
                            onDismiss={onDismiss}
                        />
                    ))}
                </div>
            ) : (
                <EmptyState filter={filter} />
            )}

            {/* Disclaimer Footer */}
            <DisclaimerFooter />
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// FILTER BUTTON
// ══════════════════════════════════════════════════════════════════════════════

function FilterButton({
    children,
    active,
    count,
    variant = "default",
    onClick,
}: {
    children: React.ReactNode;
    active: boolean;
    count: number;
    variant?: "default" | "high" | "medium";
    onClick: () => void;
}) {
    return (
        <Button
            variant={active ? "secondary" : "ghost"}
            size="sm"
            onClick={onClick}
            className={cn(
                "gap-1.5",
                active && variant === "high" && "bg-red-100 text-red-700 hover:bg-red-100",
                active && variant === "medium" && "bg-amber-100 text-amber-700 hover:bg-amber-100"
            )}
        >
            {children}
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {count}
            </Badge>
        </Button>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ══════════════════════════════════════════════════════════════════════════════

function EmptyState({ filter }: { filter: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl mb-4">🎉</div>
            <h3 className="text-lg font-medium">No alerts to show</h3>
            <p className="text-sm text-muted-foreground mt-1">
                {filter === "all"
                    ? "Your competitors haven't made any pricing changes yet."
                    : `No ${filter} priority alerts at the moment.`}
            </p>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// DISCLAIMER FOOTER
// ══════════════════════════════════════════════════════════════════════════════

export function DisclaimerFooter() {
    return (
        <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex gap-3">
                <span className="text-xl">⚠️</span>
                <div className="text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-medium mb-1">Data Accuracy Disclaimer</p>
                    <p className="text-xs leading-relaxed opacity-90">
                        Pricing information is automatically collected and may not reflect real-time
                        changes. AI explanations are generated suggestions, not definitive analysis.
                        Always verify directly on competitor websites before making business decisions.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default AlertList;
