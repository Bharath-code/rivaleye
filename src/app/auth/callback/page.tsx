"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

/**
 * Auth Callback Page
 *
 * Handles the redirect from Supabase magic link.
 * Supabase passes tokens in the URL hash, which must be handled client-side.
 */

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
);

function AuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [errorMessage, setErrorMessage] = useState<string>("");

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // Supabase automatically picks up tokens from URL hash
                const { data, error } = await supabase.auth.getSession();

                if (error) {
                    console.error("Auth callback error:", error);
                    setErrorMessage(error.message);
                    setStatus("error");
                    return;
                }

                if (!data.session) {
                    // Try to exchange code if present (for PKCE flow)
                    const code = searchParams.get("code");
                    if (code) {
                        const { data: codeData, error: codeError } = await supabase.auth.exchangeCodeForSession(code);

                        if (codeError || !codeData.session) {
                            console.error("Code exchange error:", codeError);
                            setErrorMessage(codeError?.message || "Failed to exchange code");
                            setStatus("error");
                            return;
                        }
                    } else {
                        setErrorMessage("No session found");
                        setStatus("error");
                        return;
                    }
                }

                // Sync session to server via API call
                const session = (await supabase.auth.getSession()).data.session;
                if (session) {
                    await fetch("/api/auth/sync", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            accessToken: session.access_token,
                            refreshToken: session.refresh_token,
                        }),
                    });
                }

                setStatus("success");

                // Redirect to dashboard after short delay
                setTimeout(() => {
                    const next = searchParams.get("next") || "/dashboard";
                    router.push(next);
                }, 1000);
            } catch (err) {
                console.error("Auth callback exception:", err);
                setErrorMessage("Something went wrong");
                setStatus("error");
            }
        };

        handleCallback();
    }, [router, searchParams]);

    return (
        <div className="w-full max-w-md text-center">
            {status === "loading" && (
                <>
                    <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mx-auto mb-4" />
                    <h1 className="font-display text-xl text-foreground mb-2">
                        Signing you in...
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Please wait while we verify your identity.
                    </p>
                </>
            )}

            {status === "success" && (
                <>
                    <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                    <h1 className="font-display text-xl text-foreground mb-2">
                        Welcome back!
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Redirecting to your dashboard...
                    </p>
                </>
            )}

            {status === "error" && (
                <>
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h1 className="font-display text-xl text-foreground mb-2">
                        Sign in failed
                    </h1>
                    <p className="text-sm text-muted-foreground mb-4">
                        {errorMessage || "Please try again."}
                    </p>
                    <button
                        onClick={() => router.push("/login")}
                        className="text-emerald-400 hover:underline text-sm"
                    >
                        Back to login
                    </button>
                </>
            )}
        </div>
    );
}

function LoadingFallback() {
    return (
        <div className="w-full max-w-md text-center">
            <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mx-auto mb-4" />
            <h1 className="font-display text-xl text-foreground mb-2">
                Loading...
            </h1>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 dot-grid">
            <Suspense fallback={<LoadingFallback />}>
                <AuthCallbackContent />
            </Suspense>
        </div>
    );
}

