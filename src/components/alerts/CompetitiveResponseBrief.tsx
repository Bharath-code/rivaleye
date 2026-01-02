"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Send, Sparkles, Sword, MessageSquare, Zap, Check, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface TacticalPlaybook {
    salesDraft?: string;
    productPivot?: string;
    marketingAngle?: string;
}

interface CompetitiveResponseBriefProps {
    playbook: TacticalPlaybook;
    competitorName: string;
    alertId?: string;
    isPro?: boolean;
}

export function CompetitiveResponseBrief({
    playbook,
    competitorName,
    alertId,
    isPro = true
}: CompetitiveResponseBriefProps) {
    const [copiedSection, setCopiedSection] = useState<string | null>(null);
    const [isPushing, setIsPushing] = useState(false);
    const [pushStatus, setPushStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const handleCopy = (text: string, section: string) => {
        navigator.clipboard.writeText(text);
        setCopiedSection(section);
        setTimeout(() => setCopiedSection(null), 2000);
    };

    const handleSendToSlack = async () => {
        if (!alertId) return;
        setIsPushing(true);
        setPushStatus('idle');

        try {
            const res = await fetch("/api/alerts/slack", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ alertId }),
            });

            if (!res.ok) throw new Error("Slack push failed");

            setPushStatus('success');
            setTimeout(() => setPushStatus('idle'), 3000);
        } catch (err) {
            console.error(err);
            setPushStatus('error');
            setTimeout(() => setPushStatus('idle'), 3000);
        } finally {
            setIsPushing(false);
        }
    };

    if (!isPro) {
        return (
            <Card className="glass-card noise-overlay border-dashed border-2">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sword className="w-5 h-5 text-muted-foreground" />
                        Tactical Response Playbook
                    </CardTitle>
                    <CardDescription>
                        Unlock sales scripts and product counter-moves.
                    </CardDescription>
                </CardHeader>
                <CardContent className="py-8 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                        <Zap className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h3 className="font-display text-xl mb-2">Turn Intelligence into Action</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mb-6">
                        Pro users get ready-to-send sales drafts and specific product pivots to counter competitor moves.
                    </p>
                    <Button className="saber-border glow-emerald" onClick={() => window.open("/#pricing", "_blank")}>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Upgrade to Pro
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="glass-card noise-overlay border-emerald-500/20 shadow-2xl overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
                <Badge className="bg-emerald-500 text-black font-bold uppercase tracking-tighter text-[10px]">
                    Pro Tactical Intelligence
                </Badge>
            </div>

            <CardHeader className="relative z-10">
                <CardTitle className="flex items-center gap-2 font-display text-2xl text-emerald-400">
                    <Sword className="w-6 h-6" />
                    Strategic Counter-Moves: {competitorName}
                </CardTitle>
                <CardDescription className="text-emerald-500/60">
                    AI-generated tactical playbook to maintain your competitive advantage.
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-8 relative z-10 pb-8">
                {/* Sales Draft Section */}
                {playbook.salesDraft && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-mono text-emerald-500 flex items-center gap-2 uppercase tracking-widest">
                                <MessageSquare className="w-4 h-4" />
                                Sales / Retension Draft
                            </h4>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopy(playbook.salesDraft!, 'sales')}
                                className="text-xs hover:bg-emerald-500/10 hover:text-emerald-400"
                            >
                                {copiedSection === 'sales' ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                                {copiedSection === 'sales' ? 'Copied' : 'Copy Draft'}
                            </Button>
                        </div>
                        <div className="p-4 bg-black/40 rounded-lg border border-emerald-500/10 font-mono text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                            {playbook.salesDraft}
                        </div>
                    </div>
                )}

                {/* Grid for Product and Marketing */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Product Pivot */}
                    {playbook.productPivot && (
                        <div className="space-y-3">
                            <h4 className="text-sm font-mono text-blue-400 flex items-center gap-2 uppercase tracking-widest">
                                <Zap className="w-4 h-4" />
                                Product Pivot
                            </h4>
                            <div className="p-4 bg-blue-500/5 rounded-lg border border-blue-500/10 text-sm leading-relaxed text-blue-100/80 italic">
                                "{playbook.productPivot}"
                            </div>
                        </div>
                    )}

                    {/* Marketing Angle */}
                    {playbook.marketingAngle && (
                        <div className="space-y-3">
                            <h4 className="text-sm font-mono text-purple-400 flex items-center gap-2 uppercase tracking-widest">
                                <Sparkles className="w-4 h-4" />
                                Marketing Angle
                            </h4>
                            <div className="p-4 bg-purple-500/5 rounded-lg border border-purple-500/10 text-sm leading-relaxed text-purple-100/80 italic">
                                "{playbook.marketingAngle}"
                            </div>
                        </div>
                    )}
                </div>

                {/* Workflow Footer */}
                <div className="pt-4 flex items-center justify-between border-t border-emerald-500/10">
                    <p className="text-[10px] font-mono text-muted-foreground uppercase opacity-50">
                        Generated by RivalEye Tactical Intelligence
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isPushing || !alertId}
                            onClick={handleSendToSlack}
                            className={cn(
                                "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-xs gap-2 transition-all",
                                pushStatus === 'success' && "bg-emerald-500 text-black border-emerald-500 hover:bg-emerald-600",
                                pushStatus === 'error' && "bg-red-500/20 border-red-500/50 text-red-400"
                            )}
                        >
                            {isPushing ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : pushStatus === 'success' ? (
                                <Check className="w-3 h-3" />
                            ) : (
                                <Send className="w-3 h-3" />
                            )}
                            {pushStatus === 'success' ? 'Sent to Slack' : pushStatus === 'error' ? 'Failed' : 'Send to Slack'}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
