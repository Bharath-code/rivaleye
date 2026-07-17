"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Sparkles, Check, X as XIcon } from "lucide-react";

interface CheckResult {
    brand: string;
    visibility_pct: number;
    total: number;
    mentions: number;
    results: Array<{
        model: string;
        query: string;
        mentioned: boolean;
        excerpt: string | null;
    }>;
}

export function AIVisibilityChecker() {
    const [brand, setBrand] = useState("");
    const [url, setUrl] = useState("");
    const [state, setState] = useState<"idle" | "loading" | "done" | "limited">("idle");
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<CheckResult | null>(null);

    const run = async () => {
        setError(null);
        if (!brand.trim() || !url.trim()) {
            setError("Enter your product name and website.");
            return;
        }
        setState("loading");
        try {
            const res = await fetch("/api/public/aeo-check", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ brand: brand.trim(), url: url.trim() }),
            });
            if (res.status === 429) {
                setState("limited");
                return;
            }
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || "Check failed");
            setResult(body);
            setState("done");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Check failed. Try again.");
            setState("idle");
        }
    };

    return (
        <Card className="glass-card overflow-hidden">
            <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-display text-lg">
                        Does AI recommend you?
                    </h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                    Free check — see whether ChatGPT and Gemini mention your product. No signup.
                </p>

                {state !== "done" && state !== "limited" && (
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                            placeholder="Your product name"
                            value={brand}
                            onChange={(e) => setBrand(e.target.value)}
                            aria-label="Your product name"
                        />
                        <Input
                            type="url"
                            placeholder="https://yourproduct.com"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            aria-label="Your website URL"
                        />
                        <Button
                            className="glow-emerald shrink-0"
                            onClick={run}
                            disabled={state === "loading"}
                        >
                            {state === "loading" ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Asking the AIs…
                                </>
                            ) : (
                                "Check my visibility"
                            )}
                        </Button>
                    </div>
                )}
                {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

                {state === "limited" && (
                    <div className="text-center py-4">
                        <p className="text-sm text-foreground mb-3">
                            You&apos;ve used today&apos;s free checks. Sign up to track your
                            AI visibility daily — free.
                        </p>
                        <Button asChild className="glow-emerald">
                            <Link href="/signup">Start tracking free</Link>
                        </Button>
                    </div>
                )}

                {state === "done" && result && (
                    <div>
                        <div className="flex items-baseline gap-3 mb-4">
                            <span className="text-5xl font-display font-bold text-emerald-400">
                                {result.visibility_pct.toFixed(0)}%
                            </span>
                            <span className="text-sm text-muted-foreground">
                                of AI answers mention {result.brand} ({result.mentions}/{result.total})
                            </span>
                        </div>
                        <ul className="space-y-1.5 mb-4">
                            {result.results.map((r, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs">
                                    {r.mentioned ? (
                                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                    ) : (
                                        <XIcon className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                                    )}
                                    <span className="text-muted-foreground">
                                        <span className="font-mono uppercase text-[10px] mr-1">{r.model}</span>
                                        &ldquo;{r.query}&rdquo;
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <Button asChild className="glow-emerald w-full sm:w-auto">
                            <Link href="/signup">
                                Track this daily vs your competitors — free
                            </Link>
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
