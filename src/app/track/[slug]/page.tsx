import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles, TrendingUp, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PricingTrendChart } from "@/components/charts";
import { createClient } from "@supabase/supabase-js";

/**
 * Free Public Competitor Tracker
 *
 * Route: /track/[slug]
 * Slug format: hostname with dots replaced by dashes (e.g. "stripe-com")
 *
 * - RSC: fetches server-side using service role client
 * - No auth required
 * - Edge-cached 5 min via Cache-Control header on the API
 * - Renders: company name, latest pricing, 7-day price chart, latest AI brief
 * - CTA: "Track this on RivalEye" → /signup
 *
 * SEO: title/description from competitor name, JSON-LD Product schema
 * for the listed pricing plans.
 */

interface PublicCompetitor {
    competitor: {
        name: string;
        url: string;
        lastCheckedAt: string | null;
    };
    latestAnalysis: {
        summary: string | null;
        pricing: {
            plans?: Array<{ name: string; price: string }>;
            currency?: string;
        } | null;
        positioning: {
            valueProposition?: string;
        } | null;
        timestamp: string;
        hasChanges: boolean;
    } | null;
    history: Array<{
        pricing: {
            plans?: Array<{ price_raw?: string | null }>;
        };
        currency: string | null;
        takenAt: string;
    }>;
}

async function fetchPublicCompetitor(slug: string): Promise<PublicCompetitor | null> {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return null;
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Find competitor by hostname
    const { data: competitors } = await supabase
        .from("competitors")
        .select("id, name, url, status, last_checked_at")
        .eq("status", "active")
        .limit(500);

    if (!competitors) return null;

    const match = competitors.find((c) => {
        try {
            const host = new URL(c.url).hostname.toLowerCase().replace(/\./g, "-");
            return host === slug.toLowerCase();
        } catch {
            return false;
        }
    });

    if (!match) return null;

    const [latest, history] = await Promise.all([
        supabase
            .from("analyses")
            .select("analysis_data, created_at, has_changes")
            .eq("competitor_id", match.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase
            .from("pricing_snapshots")
            .select("pricing_schema, currency_detected, taken_at")
            .eq("competitor_id", match.id)
            .order("taken_at", { ascending: false })
            .limit(7),
    ]);

    return {
        competitor: {
            name: match.name,
            url: match.url,
            lastCheckedAt: match.last_checked_at,
        },
        latestAnalysis: latest.data
            ? {
                summary: latest.data.analysis_data?.summary || null,
                pricing: latest.data.analysis_data?.pricing || null,
                positioning: latest.data.analysis_data?.positioning || null,
                timestamp: latest.data.created_at,
                hasChanges: latest.data.has_changes,
            }
            : null,
        history: (history.data || []).map((h) => ({
            pricing: h.pricing_schema,
            currency: h.currency_detected,
            takenAt: h.taken_at,
        })),
    };
}

export async function generateMetadata(
    { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
    const { slug } = await params;
    const data = await fetchPublicCompetitor(slug);
    const name = data?.competitor.name || slug.replace(/-/g, ".");

    return {
        title: data
            ? `${name} Pricing & Changes — Tracked by RivalEye`
            : `${name} — Tracked by RivalEye`,
        description: data?.latestAnalysis?.summary ||
            `Live pricing and historical changes for ${name}. Updated daily by RivalEye.`,
        openGraph: {
            title: `${name} — Live Pricing Intel`,
            description: data?.latestAnalysis?.summary ||
                `See how ${name}'s pricing has changed over time.`,
            type: "website",
        },
        alternates: { canonical: `/track/${slug}` },
    };
}

export const revalidate = 300; // 5 min edge cache

export default async function PublicTrackPage(
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    const data = await fetchPublicCompetitor(slug);

    if (!data) {
        notFound();
    }

    const { competitor, latestAnalysis, history } = data;

    // Build chart points from history (min visible price per snapshot)
    const chartPoints = history
        .map((h) => {
            const prices = (h.pricing?.plans || [])
                .map((p) => parseFloat(p.price_raw?.replace(/[^0-9.]/g, "") || "0"))
                .filter((v) => v > 0);
            const minPrice = prices.length ? Math.min(...prices) : 0;
            return {
                date: new Date(h.takenAt).toISOString().split("T")[0],
                price: minPrice,
            };
        })
        .filter((p) => p.price > 0)
        .reverse();

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* JSON-LD for SEO */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Product",
                        name: competitor.name,
                        description: latestAnalysis?.positioning?.valueProposition || `Pricing for ${competitor.name}`,
                        offers: latestAnalysis?.pricing?.plans?.map((p) => ({
                            "@type": "Offer",
                            name: p.name,
                            price: p.price,
                            priceCurrency: latestAnalysis?.pricing?.currency || "USD",
                        })),
                    }),
                }}
            />

            <main className="max-w-4xl mx-auto px-6 py-16">
                {/* Header */}
                <div className="mb-12">
                    <Link
                        href="/"
                        className="text-xs text-muted-foreground hover:text-emerald-400 mb-4 inline-block uppercase tracking-widest"
                    >
                        ← RivalEye
                    </Link>
                    <div className="flex items-center gap-3 mb-3">
                        <h1 className="font-display text-5xl text-foreground">
                            {competitor.name}
                        </h1>
                        {latestAnalysis?.hasChanges && (
                            <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded">
                                <TrendingUp className="w-3 h-3 inline mr-1" />
                                Recent change
                            </span>
                        )}
                    </div>
                    <a
                        href={competitor.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                        {competitor.url}
                        <ArrowRight className="w-3 h-3" />
                    </a>
                    {competitor.lastCheckedAt && (
                        <p className="text-xs text-muted-foreground/60 mt-2">
                            Last checked {new Date(competitor.lastCheckedAt).toLocaleDateString()}
                        </p>
                    )}
                </div>

                {/* Summary card */}
                {latestAnalysis?.summary && (
                    <Card className="glass-card mb-8">
                        <CardContent className="p-6">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3 flex items-center gap-2">
                                <Sparkles className="w-3 h-3" />
                                Latest AI Brief
                            </h2>
                            <p className="text-foreground/90 leading-relaxed">
                                {latestAnalysis.summary}
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Pricing */}
                {latestAnalysis?.pricing?.plans && latestAnalysis.pricing.plans.length > 0 && (
                    <Card className="glass-card mb-8">
                        <CardContent className="p-6">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
                                Current Pricing
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {latestAnalysis.pricing.plans.map((p, i) => (
                                    <div
                                        key={i}
                                        className="p-4 rounded-lg border border-white/10 bg-white/[0.02]"
                                    >
                                        <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
                                            {p.name}
                                        </div>
                                        <div className="font-display text-2xl">
                                            {p.price}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Price trajectory chart */}
                {chartPoints.length > 1 && (
                    <Card className="glass-card mb-8">
                        <CardContent className="p-6">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
                                Price Trajectory (last {chartPoints.length} snapshots)
                            </h2>
                            <PricingTrendChart data={chartPoints} className="w-full" />
                        </CardContent>
                    </Card>
                )}

                {/* CTA */}
                <Card className="glass-card border-emerald-500/30 mt-12">
                    <CardContent className="p-8 text-center">
                        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
                        <h2 className="font-display text-2xl mb-2">
                            Track {competitor.name} on RivalEye
                        </h2>
                        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                            Get AI-generated briefs explaining what changed, why it matters,
                            and what to consider doing — delivered before your morning coffee.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Button
                                asChild
                                variant="glow-emerald"
                                size="lg"
                            >
                                <Link href="/signup">
                                    Start Tracking Free
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Link>
                            </Button>
                            <Button
                                asChild
                                variant="outline"
                                size="lg"
                            >
                                <Link href="/#pricing">See Pricing</Link>
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground/60 mt-4">
                            Free plan: 1 competitor, 1 region, daily checks. No credit card.
                        </p>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
