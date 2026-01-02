"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { AlertDetailView } from "@/components/alerts";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import { Loader2 } from "lucide-react";
import type { PricingDiffType, AlertSeverity } from "@/lib/types";

/**
 * Alert Detail Page
 *
 * Full details view for a single alert.
 */

interface AlertData {
    id: string;
    competitor_id: string;
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
        tacticalPlaybook?: {
            salesDraft?: string;
            productPivot?: string;
            marketingAngle?: string;
        };
        screenshotPath?: string | null;
        previousScreenshotPath?: string | null;
    };
    is_read: boolean;
    created_at: string;
    competitors?: {
        name: string;
        url: string;
    };
}

export default function AlertDetailPage() {
    const router = useRouter();
    const params = useParams();
    const alertId = params.id as string;

    const [alert, setAlert] = useState<AlertData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAlert = useCallback(async () => {
        try {
            const res = await fetch(`/api/alerts/${alertId}`);

            if (res.status === 401) {
                router.push("/login");
                return;
            }

            if (!res.ok) {
                throw new Error("Failed to fetch alert");
            }

            const data = await res.json();

            // Transform data
            const alertData = data.alert;
            let parsedDetails = alertData.details || {};

            // Try to parse ai_insight for extra context (insights/playbooks)
            if (alertData.ai_insight) {
                try {
                    const parsed = typeof alertData.ai_insight === "string"
                        ? JSON.parse(alertData.ai_insight)
                        : alertData.ai_insight;

                    if (!parsedDetails.aiExplanation) {
                        parsedDetails.aiExplanation = parsed.whyItMatters || parsed.whatChanged;
                    }
                    if (!parsedDetails.tacticalPlaybook && parsed.tacticalPlaybook) {
                        parsedDetails.tacticalPlaybook = parsed.tacticalPlaybook;
                    }
                } catch (e) {
                    console.error("Failed to parse ai_insight", e);
                    if (!parsedDetails.aiExplanation) {
                        parsedDetails.aiExplanation = alertData.ai_insight;
                    }
                }
            }

            setAlert({
                ...alertData,
                competitor_name: alertData.competitors?.name || "Unknown",
                type: alertData.type || "price_increase",
                severity: alertData.severity || "medium",
                title: alertData.title || alertData.diff_summary || "Pricing Change",
                description: alertData.description || alertData.diff_summary || "",
                details: parsedDetails,
            });

            // Mark as read
            if (!alertData.is_read) {
                await fetch(`/api/alerts/${alertId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ is_read: true }),
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load alert");
        } finally {
            setIsLoading(false);
        }
    }, [alertId, router]);

    useEffect(() => {
        if (alertId) {
            fetchAlert();
        }
    }, [alertId, fetchAlert]);

    const handleBack = () => {
        router.push("/dashboard/alerts");
    };

    const handleSuppressType = async (type: PricingDiffType) => {
        // TODO: Implement alert suppression settings
        console.log("Suppress type:", type);
    };

    const handleVerifyOnSite = () => {
        if (alert?.competitors?.url) {
            window.open(alert.competitors.url, "_blank");
        }
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </main>
                <Footer />
            </div>
        );
    }

    if (error || !alert) {
        return (
            <div className="flex-1 flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-red-500 mb-4">{error || "Alert not found"}</p>
                        <button
                            onClick={handleBack}
                            className="text-primary underline"
                        >
                            Back to Alerts
                        </button>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-screen">
            <Header />

            <main className="flex-1 pt-24 pb-12 px-6">
                <AlertDetailView
                    alert={alert}
                    onBack={handleBack}
                    onSuppressType={handleSuppressType}
                    onVerifyOnSite={handleVerifyOnSite}
                />
            </main>

            <Footer />
        </div>
    );
}
