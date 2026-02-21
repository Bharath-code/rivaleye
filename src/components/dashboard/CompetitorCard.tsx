"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    ExternalLink,
    RefreshCw,
    Clock,
    AlertCircle,
    Loader2,
    LineChart,
    Pencil,
    Trash2,
} from "lucide-react";

interface Competitor {
    id: string;
    name: string;
    url: string;
    status: "active" | "paused" | "error";
    last_checked_at: string | null;
    failure_count: number;
    created_at: string;
}

interface CompetitorCardProps {
    competitor: Competitor;
    analyzingId: string | null;
    onAnalyze: (id: string) => void;
    onViewHistory: (competitor: Competitor) => void;
    onEdit: (competitor: Competitor) => void;
    onDelete: (competitor: Competitor) => void;
    onNavigate: (id: string) => void;
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

export function CompetitorCard({
    competitor,
    analyzingId,
    onAnalyze,
    onViewHistory,
    onEdit,
    onDelete,
    onNavigate,
}: CompetitorCardProps) {
    return (
        <Card className="glass-card hover:border-emerald-500/30 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                    <CardTitle
                        className="text-base font-medium cursor-pointer hover:text-emerald-400 transition-colors"
                        onClick={() => onNavigate(competitor.id)}
                    >
                        {competitor.name}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 text-muted-foreground hover:text-emerald-400"
                            onClick={() => onViewHistory(competitor)}
                            title="View History"
                            aria-label={`View pricing history for ${competitor.name}`}
                        >
                            <LineChart className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 text-muted-foreground hover:text-blue-400"
                            onClick={() => onEdit(competitor)}
                            title="Edit Competitor"
                            aria-label={`Edit ${competitor.name}`}
                        >
                            <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 text-muted-foreground hover:text-red-400"
                            onClick={() => onDelete(competitor)}
                            title="Delete Competitor"
                            aria-label={`Delete ${competitor.name}`}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 text-muted-foreground hover:text-foreground"
                            onClick={() => window.open(competitor.url, "_blank")}
                            title="Direct Link"
                            aria-label={`Open ${competitor.name} website in new tab`}
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
                <div className="mt-5">
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs h-9 bg-emerald-500/[0.05] border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black hover:border-emerald-500 transition-all duration-300 font-medium"
                        onClick={() => onAnalyze(competitor.id)}
                        disabled={analyzingId === competitor.id}
                    >
                        {analyzingId === competitor.id ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                                Scanning...
                            </>
                        ) : (
                            <span className="flex items-center gap-1.5">
                                <RefreshCw className="w-3.5 h-3.5" />
                                Scan Now
                            </span>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
