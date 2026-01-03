"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Check, Loader2, Sparkles, Target, Globe2, X } from "lucide-react";
import { analytics } from "@/components/providers/AnalyticsProvider";

interface OnboardingWizardProps {
    onComplete: (competitorUrl: string, competitorName: string) => Promise<void>;
    onSkip: () => void;
}

const EXAMPLE_COMPETITORS = [
    { name: "Stripe", url: "https://stripe.com/pricing" },
    { name: "Notion", url: "https://www.notion.so/pricing" },
    { name: "Linear", url: "https://linear.app/pricing" },
    { name: "Figma", url: "https://www.figma.com/pricing" },
];

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
    const [step, setStep] = useState(1);
    const [url, setUrl] = useState("");
    const [name, setName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSelectExample = (example: { name: string; url: string }) => {
        setUrl(example.url);
        setName(example.name);
    };

    const handleSubmit = async () => {
        if (!url.trim()) {
            setError("Please enter a competitor URL");
            return;
        }

        // Basic URL validation
        try {
            new URL(url);
        } catch {
            setError("Please enter a valid URL");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await onComplete(url, name || new URL(url).hostname);
            analytics.onboardingCompetitorAdded();
            analytics.onboardingCompleted();
            setStep(3);
        } catch (err) {
            setError("Failed to add competitor. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <Card className="glass-card w-full max-w-lg mx-4 relative overflow-hidden">
                {/* Skip button */}
                <button
                    onClick={onSkip}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Decorative background */}
                <div className="absolute inset-0 opacity-5 pointer-events-none">
                    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="onboardingGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                                <circle cx="2" cy="2" r="1" fill="currentColor" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#onboardingGrid)" />
                    </svg>
                </div>

                <CardContent className="p-8 relative z-10">
                    {/* Step 1: Welcome */}
                    {step === 1 && (
                        <div className="text-center stagger-children">
                            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-6 glow-emerald">
                                <Target className="w-8 h-8 text-emerald-400" />
                            </div>
                            <h2 className="font-display text-2xl text-foreground mb-3">
                                Deploy Your First Sensor
                            </h2>
                            <p className="text-muted-foreground mb-8 leading-relaxed">
                                RivalEye monitors competitor pricing pages 24/7. When something changes,
                                you get a tactical brief with actionable insights.
                            </p>

                            <div className="flex items-center justify-center gap-6 mb-8 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <Globe2 className="w-4 h-4 text-emerald-400" />
                                    <span>8 Regions</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-emerald-400" />
                                    <span>AI Analysis</span>
                                </div>
                            </div>

                            <Button
                                size="lg"
                                className="glow-emerald gap-2"
                                onClick={() => setStep(2)}
                            >
                                Let&apos;s Go
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        </div>
                    )}

                    {/* Step 2: Add Competitor */}
                    {step === 2 && (
                        <div>
                            <h2 className="font-display text-xl text-foreground mb-2">
                                Add Your First Competitor
                            </h2>
                            <p className="text-sm text-muted-foreground mb-6">
                                Enter the URL of a competitor&apos;s pricing page, or pick one of our suggestions.
                            </p>

                            <div className="space-y-4 mb-6">
                                <div className="space-y-2">
                                    <Label htmlFor="competitor-url">Pricing Page URL</Label>
                                    <Input
                                        id="competitor-url"
                                        type="url"
                                        placeholder="https://competitor.com/pricing"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        className={error ? "border-red-500" : ""}
                                    />
                                    {error && (
                                        <p className="text-xs text-red-400">{error}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="competitor-name">Competitor Name (Optional)</Label>
                                    <Input
                                        id="competitor-name"
                                        type="text"
                                        placeholder="Acme Corp"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Example suggestions */}
                            <div className="mb-6">
                                <p className="text-xs text-muted-foreground mb-2">Or try one of these:</p>
                                <div className="flex flex-wrap gap-2">
                                    {EXAMPLE_COMPETITORS.map((example) => (
                                        <button
                                            key={example.name}
                                            onClick={() => handleSelectExample(example)}
                                            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${url === example.url
                                                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                                                : "border-border text-muted-foreground hover:border-emerald-500/30"
                                                }`}
                                        >
                                            {example.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setStep(1)}
                                >
                                    Back
                                </Button>
                                <Button
                                    className="flex-1 glow-emerald gap-2"
                                    onClick={handleSubmit}
                                    disabled={isSubmitting || !url.trim()}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Deploying...
                                        </>
                                    ) : (
                                        <>
                                            Deploy Sensor
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Confirmation */}
                    {step === 3 && (
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                                <Check className="w-8 h-8 text-emerald-400" />
                            </div>
                            <h2 className="font-display text-2xl text-foreground mb-3">
                                Sensor Deployed! 🎯
                            </h2>
                            <p className="text-muted-foreground mb-2">
                                We&apos;ll check <span className="text-foreground font-medium">{name || new URL(url).hostname}</span> daily.
                            </p>
                            <p className="text-sm text-muted-foreground mb-8">
                                You&apos;ll receive an email the moment their pricing strategy changes.
                            </p>

                            <Button
                                size="lg"
                                className="glow-emerald gap-2"
                                onClick={onSkip}
                            >
                                Go to Dashboard
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        </div>
                    )}
                </CardContent>

                {/* Progress indicator */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/30">
                    <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${(step / 3) * 100}%` }}
                    />
                </div>
            </Card>
        </div>
    );
}

export default OnboardingWizard;
