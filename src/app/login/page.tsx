"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        const { error: authError } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        });

        setIsSubmitting(false);

        if (authError) {
            setError(authError.message);
            return;
        }

        setIsSubmitted(true);
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 dot-grid">
            <Link
                href="/"
                className="absolute top-6 left-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to home
            </Link>

            <Card className="w-full max-w-md glass-card">
                <CardHeader className="text-center">
                    <div className="w-12 h-12 rounded-lg bg-emerald-500 flex items-center justify-center mx-auto mb-4 glow-emerald">
                        <svg
                            viewBox="0 0 24 24"
                            className="w-6 h-6 text-background"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="12" cy="12" r="10" />
                            <circle cx="12" cy="12" r="4" />
                        </svg>
                    </div>
                    <CardTitle className="font-display text-2xl">
                        {isSubmitted ? "Check your email" : "Sign in to RivalEye"}
                    </CardTitle>
                    <CardDescription>
                        {isSubmitted
                            ? "We sent you a magic link to sign in."
                            : "Enter your email to receive a magic link."}
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    {isSubmitted ? (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                                We sent a magic link to <span className="text-foreground font-medium">{email}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Didn&apos;t receive it?{" "}
                                <button
                                    onClick={() => setIsSubmitted(false)}
                                    className="text-emerald-400 hover:underline"
                                >
                                    Try again
                                </button>
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email address</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="you@company.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-10"
                                        required
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={isSubmitting || !email}
                            >
                                {isSubmitting ? "Sending link..." : "Send Magic Link"}
                            </Button>

                            <p className="text-xs text-center text-muted-foreground">
                                By signing in, you agree to our{" "}
                                <Link href="/terms" className="text-emerald-400 hover:underline">
                                    Terms
                                </Link>{" "}
                                and{" "}
                                <Link href="/privacy" className="text-emerald-400 hover:underline">
                                    Privacy Policy
                                </Link>
                            </p>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
