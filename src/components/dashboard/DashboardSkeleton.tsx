"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Skeleton loading states for the dashboard.
 * Replaces the single spinner with structured content placeholders.
 */

function Shimmer({ className = "" }: { className?: string }) {
    return (
        <div
            className={`animate-pulse rounded-md bg-muted/40 ${className}`}
        />
    );
}

export function CompetitorCardSkeleton() {
    return (
        <Card className="glass-card">
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                        <Shimmer className="h-5 w-32" />
                        <Shimmer className="h-3 w-48" />
                    </div>
                    <Shimmer className="h-5 w-14 rounded-full" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between mb-5">
                    <Shimmer className="h-3 w-20" />
                </div>
                <Shimmer className="h-9 w-full rounded-md" />
            </CardContent>
        </Card>
    );
}

export function AlertSkeleton() {
    return (
        <Card className="glass-card">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <Shimmer className="h-5 w-40" />
                    <Shimmer className="h-4 w-16" />
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border/50">
                        <Shimmer className="h-8 w-8 rounded-full shrink-0" />
                        <div className="flex-1 space-y-2">
                            <Shimmer className="h-4 w-3/4" />
                            <Shimmer className="h-3 w-1/2" />
                        </div>
                        <Shimmer className="h-5 w-12 rounded-full" />
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

export function MarketRadarSkeleton() {
    return (
        <Card className="glass-card overflow-hidden">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <Shimmer className="h-6 w-56" />
                        <Shimmer className="h-4 w-72" />
                    </div>
                    <Shimmer className="h-5 w-24 rounded-full" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <Shimmer className="aspect-square max-w-[400px] mx-auto w-full rounded-xl" />
                    <div className="space-y-4">
                        <Shimmer className="h-24 w-full rounded-xl" />
                        <div className="grid grid-cols-2 gap-4">
                            <Shimmer className="h-20 rounded-xl" />
                            <Shimmer className="h-20 rounded-xl" />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export function DashboardSkeleton() {
    return (
        <div className="max-w-6xl mx-auto">
            {/* Header skeleton */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <Shimmer className="h-10 w-48" />
                        <Shimmer className="h-5 w-14 rounded-full" />
                        <Shimmer className="h-6 w-20 rounded-sm" />
                    </div>
                    <Shimmer className="h-4 w-80" />
                </div>
                <div className="flex items-center gap-3">
                    <Shimmer className="h-10 w-36 rounded-md" />
                    <Shimmer className="h-10 w-40 rounded-md" />
                </div>
            </div>

            {/* Radar skeleton (Pro) */}
            <div className="mb-8">
                <MarketRadarSkeleton />
            </div>

            {/* Grid skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-4">
                    <Shimmer className="h-4 w-32 mb-4" />
                    <CompetitorCardSkeleton />
                    <CompetitorCardSkeleton />
                </div>
                <div className="lg:col-span-2">
                    <AlertSkeleton />
                </div>
            </div>
        </div>
    );
}
