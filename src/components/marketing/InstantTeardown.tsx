"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { analytics } from "@/components/providers/AnalyticsProvider";
import { ArrowRight, Loader2, Search } from "lucide-react";
import type { PricingSchema } from "@/lib/types";

interface TeardownResult {
    success: true;
    url: string;
    pricing: PricingSchema;
    screenshotUrl: string | null;
}

interface TeardownError {
    error: string;
}

export function InstantTeardown() {
    const [url, setUrl] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [result, setResult] = useState<TeardownResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!url.trim() || status === "loading") return;

        setStatus("loading");
        setError(null);
        setResult(null);
        analytics.teardownSubmitted();

        try {
            const res = await fetch("/api/public/teardown", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
            });
            const data: TeardownResult | TeardownError = await res.json();

            if (!res.ok || !("success" in data)) {
                const message = (data as TeardownError).error || "Couldn't tear down that page.";
                setError(message);
                setStatus("error");
                analytics.teardownFailed(message);
                return;
            }

            setResult(data);
            setStatus("done");
            analytics.teardownSucceeded();
        } catch {
            setError("Something went wrong. Try again.");
            setStatus("error");
            analytics.teardownFailed("network_error");
        }
    }

    return (
        <div className="max-w-2xl mx-auto gsap-reveal">
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                <Input
                    type="url"
                    required
                    placeholder="Paste a competitor's pricing page URL…"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="h-12 text-base"
                    disabled={status === "loading"}
                />
                <Button
                    type="submit"
                    size="lg"
                    variant="glow-emerald"
                    disabled={status === "loading"}
                    className="h-12 shrink-0 gap-2"
                >
                    {status === "loading" ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Tearing down…
                        </>
                    ) : (
                        <>
                            <Search className="w-4 h-4" />
                            Instant Teardown
                        </>
                    )}
                </Button>
            </form>

            {status === "error" && (
                <p className="text-sm text-red-400 mt-4 text-center">{error}</p>
            )}

            {status === "done" && result && (
                <div className="glass-card rounded-2xl p-6 sm:p-8 mt-8 text-left border-emerald-500/20">
                    {result.screenshotUrl && (
                        // Firecrawl full-page screenshots have no fixed aspect ratio (varies
                        // per site), so cap height and let it scroll rather than force a ratio.
                        <div className="relative rounded-lg overflow-hidden border border-border mb-6 bg-muted/20 max-h-[420px] overflow-y-auto">
                            <img
                                src={result.screenshotUrl}
                                alt={`Screenshot of ${result.url}`}
                                className="w-full h-auto block"
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                        {result.pricing.plans.map((plan) => (
                            <div
                                key={plan.id}
                                className={`p-4 rounded-lg border ${plan.name === result.pricing.highlighted_plan
                                    ? "border-emerald-500/40 bg-emerald-500/5"
                                    : "border-border bg-muted/20"
                                    }`}
                            >
                                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                                    {plan.name}
                                </div>
                                <div className="text-lg font-display text-foreground">
                                    {plan.price_visible ? plan.price_raw : "Contact sales"}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <p className="text-sm text-muted-foreground">
                            That's a live snapshot. RivalEye tracks changes like this daily.
                        </p>
                        <Link href="/login">
                            <Button variant="glow-emerald" className="gap-2">
                                Track This Free
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
