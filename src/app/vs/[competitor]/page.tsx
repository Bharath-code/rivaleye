import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Check, X, ArrowRight, Sparkles, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import competitorsData from "@/data/competitors.json";

/**
 * /vs/[competitor] — Programmatic SEO comparison pages
 *
 * Template-driven from src/data/competitors.json. 10 pages shipped
 * (klue, crayon, visualping, kompyte, prisync, competitorinsight,
 * datanyze, spyglown, diffbot, watchful).
 *
 * SEO targets:
 *   - "[competitor] alternative" (~3K monthly)
 *   - "[competitor] vs [us]" (~1.8K monthly)
 *   - "[competitor] pricing" / "[competitor] review"
 *
 * Each page is ≥1500 words, JSON-LD structured, internally linked
 * to /for/[industry] and /track/[slug] clusters.
 */

interface Competitor {
    slug: string;
    name: string;
    tagline: string;
    url: string;
    founded: number;
    headquarters: string;
    pricing: {
        starting: string;
        model: string;
        tier: string;
        freeTier: boolean;
    };
    bestFor: string;
    strengths: string[];
    weaknesses: string[];
    keyDifferences: string[];
    verdict: {
        [key: string]: string;
    };
}

const competitors: Competitor[] = competitorsData.competitors;

function getCompetitor(slug: string): Competitor | undefined {
    return competitors.find((c) => c.slug === slug);
}

export function generateStaticParams() {
    return competitors.map((c) => ({ competitor: c.slug }));
}

export async function generateMetadata(
    { params }: { params: Promise<{ competitor: string }> }
): Promise<Metadata> {
    const { competitor: slug } = await params;
    const c = getCompetitor(slug);
    if (!c) return { title: "Comparison not found" };

    return {
        title: `RivalEye vs ${c.name}: which competitive intelligence tool is right for you? (2026)`,
        description: `Honest comparison of RivalEye and ${c.name}. Pricing, features, AI insights, geo-aware pricing tracking, and who each tool is best for.`,
        keywords: [
            `${c.name} alternative`,
            `${c.name} vs RivalEye`,
            `${c.name} review`,
            `${c.name} pricing`,
            `competitive intelligence tool`,
        ],
        alternates: { canonical: `/vs/${c.slug}` },
        openGraph: {
            title: `RivalEye vs ${c.name}`,
            description: `Side-by-side comparison: pricing, features, AI capabilities. Updated for 2026.`,
            type: "article",
            url: `/vs/${c.slug}`,
        },
    };
}

export default async function VsPage(
    { params }: { params: Promise<{ competitor: string }> }
) {
    const { competitor: slug } = await params;
    const c = getCompetitor(slug);
    if (!c) notFound();

    // JSON-LD: Product comparison schema
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: `RivalEye vs ${c.name}: which competitive intelligence tool is right for you?`,
        description: `Side-by-side comparison of RivalEye and ${c.name}.`,
        author: { "@type": "Organization", name: "RivalEye" },
        publisher: { "@type": "Organization", name: "RivalEye" },
        datePublished: "2026-06-09",
        dateModified: "2026-06-09",
        about: [
            { "@type": "SoftwareApplication", name: "RivalEye" },
            { "@type": "SoftwareApplication", name: c.name },
        ],
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            <main className="max-w-4xl mx-auto px-6 py-16">
                {/* Header */}
                <header className="mb-12">
                    <Link
                        href="/"
                        className="text-xs text-muted-foreground hover:text-emerald-400 mb-4 inline-block uppercase tracking-widest"
                    >
                        ← RivalEye
                    </Link>
                    <h1 className="font-display text-4xl md:text-5xl mb-4 leading-tight">
                        RivalEye vs <span className="text-emerald-400">{c.name}</span>
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl">
                        {c.tagline}. We built RivalEye for indie founders and small
                        teams who want automated, AI-powered competitor pricing
                        monitoring without the enterprise price tag. Here's how we
                        compare to {c.name} in 2026.
                    </p>
                </header>

                {/* Quick verdict cards */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
                    <Card className="glass-card border-emerald-500/30">
                        <CardContent className="p-5">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-2 flex items-center gap-2">
                                <Sparkles className="w-3 h-3" />
                                Choose RivalEye if…
                            </h3>
                            <p className="text-sm text-foreground/90">
                                {c.verdict.chooseRivalEye}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="glass-card">
                        <CardContent className="p-5">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                                Choose {c.name} if…
                            </h3>
                            <p className="text-sm text-foreground/90">
                                {c.verdict.chooseCompetitor}
                            </p>
                        </CardContent>
                    </Card>
                </section>

                {/* Pricing comparison */}
                <section className="mb-12">
                    <h2 className="font-display text-2xl mb-4">Pricing at a glance</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="glass-card">
                            <CardContent className="p-5">
                                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 mb-3">
                                    RivalEye
                                </Badge>
                                <p className="text-2xl font-display mb-1">Free to start</p>
                                <p className="text-sm text-muted-foreground">
                                    Pro: $49/mo · 5 competitors · 4 regions · AI briefs · Slack alerts
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="glass-card">
                            <CardContent className="p-5">
                                <Badge variant="outline" className="mb-3">{c.name}</Badge>
                                <p className="text-2xl font-display mb-1">{c.pricing.starting}</p>
                                <p className="text-sm text-muted-foreground">
                                    {c.pricing.model} · {c.pricing.tier}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </section>

                {/* Key differences */}
                <section className="mb-12">
                    <h2 className="font-display text-2xl mb-4">
                        4 key differences that matter
                    </h2>
                    <div className="space-y-3">
                        {c.keyDifferences.map((diff, i) => (
                            <Card key={i} className="glass-card">
                                <CardContent className="p-5 flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 text-emerald-400 text-xs font-bold">
                                        {i + 1}
                                    </div>
                                    <p className="text-foreground/90">{diff}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>

                {/* Strengths vs weaknesses */}
                <section className="mb-12">
                    <h2 className="font-display text-2xl mb-4">
                        Where {c.name} wins (and loses)
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-2">
                                <Check className="w-4 h-4" />
                                Strengths
                            </h3>
                            <ul className="space-y-2">
                                {c.strengths.map((s, i) => (
                                    <li key={i} className="text-sm text-foreground/90 flex items-start gap-2">
                                        <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                                        {s}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
                                <X className="w-4 h-4" />
                                Weaknesses
                            </h3>
                            <ul className="space-y-2">
                                {c.weaknesses.map((w, i) => (
                                    <li key={i} className="text-sm text-foreground/90 flex items-start gap-2">
                                        <X className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                                        {w}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Best for */}
                <section className="mb-12">
                    <h2 className="font-display text-2xl mb-4">Who {c.name} is best for</h2>
                    <Card className="glass-card">
                        <CardContent className="p-5">
                            <p className="text-foreground/90">{c.bestFor}</p>
                            <p className="text-xs text-muted-foreground mt-3">
                                Founded {c.founded} · {c.headquarters} · {c.url}
                            </p>
                        </CardContent>
                    </Card>
                </section>

                {/* The RivalEye approach — long-form content (the SEO meat) */}
                <section className="mb-12 prose prose-invert max-w-none">
                    <h2 className="font-display text-2xl mb-4">
                        The RivalEye approach to competitive intelligence
                    </h2>
                    <p className="text-foreground/90 leading-relaxed mb-4">
                        Most competitive intelligence tools — including {c.name} —
                        are built for enterprise enablement teams. They assume
                        you have a dedicated analyst, a six-figure annual budget,
                        and 4-8 weeks of onboarding time.
                    </p>
                    <p className="text-foreground/90 leading-relaxed mb-4">
                        RivalEye takes a different approach. We use Vision AI
                        (Gemini 2.0 Flash) to screenshot competitor pricing pages
                        every day, extract structured pricing data, compare it
                        to yesterday, and write a tactical brief in your
                        inbox: <em>what changed, why it may matter, what to
                        consider doing</em>.
                    </p>
                    <p className="text-foreground/90 leading-relaxed mb-4">
                        The result: you spend 30 seconds a day reading one alert
                        instead of 5 hours a week manually checking competitor
                        sites. And because we track 4 regions (US, EU, India,
                        Latin America) simultaneously, you catch geo-pricing
                        arbitrage moves that single-region tools miss entirely.
                    </p>
                    <p className="text-foreground/90 leading-relaxed">
                        We're not trying to replace {c.name} for enterprises.
                        If you need battlecards, sales-team distribution, and
                        field-intel workflows, {c.name} is a solid choice. But
                        if you're an indie founder or small team who wants
                        automated pricing monitoring without the enterprise
                        overhead, RivalEye is built for you.
                    </p>
                </section>

                {/* Internal links to other SEO pages */}
                <section className="mb-12 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="glass-card">
                        <CardContent className="p-5">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 mb-2">
                                Track a competitor for free
                            </h3>
                            <p className="text-sm text-muted-foreground mb-3">
                                Try our public tracker. No signup required.
                            </p>
                            <Button asChild variant="outline" size="sm">
                                <Link href="/track">
                                    Browse tracked competitors
                                    <ArrowRight className="w-3 h-3 ml-2" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                    <Card className="glass-card">
                        <CardContent className="p-5">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 mb-2">
                                See RivalEye in your industry
                            </h3>
                            <p className="text-sm text-muted-foreground mb-3">
                                Workflows tailored to SaaS, e-commerce, fintech, agencies, dev tools.
                            </p>
                            <Button asChild variant="outline" size="sm">
                                <Link href="/for/saas">
                                    Browse by industry
                                    <ArrowRight className="w-3 h-3 ml-2" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </section>

                {/* Final CTA */}
                <Card className="glass-card border-emerald-500/30">
                    <CardContent className="p-8 text-center">
                        <MapPin className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                        <h2 className="font-display text-2xl mb-2">
                            Try RivalEye free
                        </h2>
                        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                            1 competitor, 1 region, daily checks. No credit card.
                            See why indie founders are switching from {c.name}.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Button asChild variant="glow-emerald" size="lg">
                                <Link href="/signup">
                                    Start tracking free
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="lg">
                                <Link href="/#pricing">See pricing</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
