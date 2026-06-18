"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PartyPopper, Twitter, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * FirstAlertCelebration
 *
 * Shown once per user, the first time they receive an alert.
 * Triggers canvas-confetti and presents a "You just caught [competitor]'s
 * change before [X]% of the market" modal.
 *
 * Persistence: stores a `first_alert_celebrated: true` flag in localStorage
 * so it never shows again. (The persistent DB column is a future improvement.)
 *
 * Trigger: dashboard page detects alert count == 1 and renders this.
 */

interface Props {
    competitorName: string;
    alertTitle: string;
    onDismiss: () => void;
}

export function FirstAlertCelebration({ competitorName, alertTitle, onDismiss }: Props) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        let cancelled = false;

        // Delay so the user can see the alert arrive first
        const showTimer = setTimeout(() => setIsVisible(true), 600);

        // Burst confetti when shown. Dynamically imported so canvas-confetti
        // stays out of the initial bundle (PERF-2), and skipped under
        // prefers-reduced-motion (a11y).
        const prefersReduced = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;
        const confettiTimer = setTimeout(() => {
            if (prefersReduced) return;
            import("canvas-confetti").then(({ default: confetti }) => {
                if (cancelled) return; // unmounted before import resolved
                confetti({
                    particleCount: 120,
                    spread: 80,
                    origin: { y: 0.6 },
                    colors: ["#10b981", "#34d399", "#6ee7b7", "#fbbf24", "#f59e0b"],
                });
            });
        }, 900);

        return () => {
            cancelled = true;
            clearTimeout(showTimer);
            clearTimeout(confettiTimer);
        };
    }, []);

    if (!isVisible) return null;

    const tweetText = encodeURIComponent(
        `I just caught ${competitorName}'s pricing change on day one with RivalEye 🔥\n\n${alertTitle.slice(0, 100)}\n\nrivaleye.com`
    );
    const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;

    const handleDismiss = () => {
        try {
            localStorage.setItem("rivaleye:first-alert-celebrated", "1");
        } catch {
            // localStorage may be unavailable (private mode)
        }
        onDismiss();
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
            <Card className="glass-card max-w-md w-full border-emerald-500/30 relative">
                <button
                    onClick={handleDismiss}
                    className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
                    aria-label="Dismiss celebration"
                >
                    <X className="w-4 h-4" />
                </button>
                <CardContent className="p-8 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                        <PartyPopper className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h2 className="font-display text-2xl mb-2">
                        Your first alert!
                    </h2>
                    <p className="text-sm text-muted-foreground mb-6">
                        You caught <span className="text-emerald-400 font-semibold">{competitorName}</span>&apos;s
                        change before 99% of their market.
                    </p>
                    <div className="flex flex-col gap-2">
                        <Button
                            asChild
                            variant="glow-emerald"
                            className="w-full"
                        >
                            <Link href="/dashboard/alerts">
                                View the alert
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Link>
                        </Button>
                        <Button
                            asChild
                            variant="outline"
                            className="w-full"
                        >
                            <a href={tweetUrl} target="_blank" rel="noopener noreferrer">
                                <Twitter className="w-4 h-4 mr-2" />
                                Share to X
                            </a>
                        </Button>
                        <button
                            onClick={handleDismiss}
                            className="text-xs text-muted-foreground hover:text-foreground mt-2"
                        >
                            Maybe later
                        </button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

/**
 * Returns true if the user has not yet seen the celebration.
 * Call from the dashboard page on each render.
 */
export function shouldShowFirstAlertCelebration(alertCount: number): boolean {
    if (alertCount !== 1) return false;
    if (typeof window === "undefined") return false;
    try {
        return !localStorage.getItem("rivaleye:first-alert-celebrated");
    } catch {
        return false;
    }
}
