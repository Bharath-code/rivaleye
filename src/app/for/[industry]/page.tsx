import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Lightbulb, Target, Wrench, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import industriesData from "@/data/industries.json";

/**
 * /for/[industry] — Programmatic SEO industry pages
 *
 * 5 pages shipped (saas, ecommerce, agencies, fintech, devtools).
 *
 * SEO targets:
 *   - "competitive intelligence for [industry]" (~500 monthly)
 *   - "competitor tracking for [industry]"
 *   - "[industry] pricing strategy"
 *   - "best competitive intelligence tools for [industry]"
 *
 * Each page is a top-of-funnel landing for a specific ICP, with
 * industry-specific pain points, workflows, queries, and tactics.
 */

interface Industry {
    slug: string;
    name: string;
    headline: string;
    painPoint: string;
    workflow: string;
    topCompetitors: string[];
    exampleQueries: string[];
    tactics: string[];
}

const industries: Industry[] = industriesData.industries;

function getIndustry(slug: string): Industry | undefined {
    return industries.find((i) => i.slug === slug);
}

export function generateStaticParams() {
    return industries.map((i) => ({ industry: i.slug }));
}

export async function generateMetadata(
    { params }: { params: Promise<{ industry: string }> }
): Promise<Metadata> {
    const { industry: slug } = await params;
    const i = getIndustry(slug);
    if (!i) return { title: "Industry page not found" };

    return {
        title: `Competitive intelligence for ${i.name}: track pricing & positioning (2026)`,
        description: `How ${i.name.toLowerCase()} teams use RivalEye to track competitor pricing, get AI briefs, and react faster. Real workflows, real queries, real tactics.`,
        keywords: [
            `competitive intelligence for ${i.name.toLowerCase()}`,
            `${i.name.toLowerCase()} competitor tracking`,
            `${i.name.toLowerCase()} pricing strategy`,
            `best CI tools for ${i.name.toLowerCase()}`,
        ],
        alternates: { canonical: `/for/${i.slug}` },
        openGraph: {
            title: `Competitive intelligence for ${i.name}`,
            description: `How ${i.name.toLowerCase()} teams track competitor pricing with AI.`,
            type: "article",
            url: `/for/${i.slug}`,
        },
    };
}

export default async function ForIndustryPage(
    { params }: { params: Promise<{ industry: string }> }
) {
    const { industry: slug } = await params;
    const i = getIndustry(slug);
    if (!i) notFound();

    return (
        <div className="min-h-screen bg-background text-foreground">
            <main className="max-w-4xl mx-auto px-6 py-16">
                <header className="mb-12">
                    <Link
                        href="/"
                        className="text-xs text-muted-foreground hover:text-emerald-400 mb-4 inline-block uppercase tracking-widest"
                    >
                        ← RivalEye
                    </Link>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 mb-4">
                        For {i.name} teams
                    </Badge>
                    <h1 className="font-display text-4xl md:text-5xl mb-4 leading-tight">
                        {i.headline}
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl">
                        Practical workflows, real queries, and tactics you can
                        use this week to track competitor pricing in {i.name.toLowerCase()}.
                    </p>
                </header>

                {/* The pain */}
                <section className="mb-12">
                    <Card className="glass-card border-amber-500/30">
                        <CardContent className="p-6 flex items-start gap-4">
                            <Target className="w-6 h-6 text-amber-400 flex-shrink-0 mt-1" />
                            <div>
                                <h2 className="font-display text-xl mb-2">
                                    The {i.name.toLowerCase()} reality
                                </h2>
                                <p className="text-foreground/90 leading-relaxed">
                                    {i.painPoint}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* The workflow */}
                <section className="mb-12">
                    <h2 className="font-display text-2xl mb-4 flex items-center gap-2">
                        <Wrench className="w-5 h-5 text-emerald-400" />
                        How {i.name.toLowerCase()} teams use RivalEye
                    </h2>
                    <Card className="glass-card">
                        <CardContent className="p-6">
                            <p className="text-foreground/90 leading-relaxed">
                                {i.workflow}
                            </p>
                        </CardContent>
                    </Card>
                </section>

                {/* Example queries */}
                <section className="mb-12">
                    <h2 className="font-display text-2xl mb-4 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-emerald-400" />
                        Questions you can answer with RivalEye's semantic search
                    </h2>
                    <div className="space-y-2">
                        {i.exampleQueries.map((q, idx) => (
                            <Card key={idx} className="glass-card">
                                <CardContent className="p-4 flex items-start gap-3">
                                    <span className="text-emerald-400 font-mono text-xs mt-1">
                                        {`> `}
                                    </span>
                                    <p className="text-foreground/90 italic flex-1">
                                        "{q}"
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>

                {/* Tactics */}
                <section className="mb-12">
                    <h2 className="font-display text-2xl mb-4 flex items-center gap-2">
                        <Lightbulb className="w-5 h-5 text-emerald-400" />
                        Tactics that work
                    </h2>
                    <Card className="glass-card">
                        <CardContent className="p-6">
                            <ul className="space-y-3">
                                {i.tactics.map((t, idx) => (
                                    <li key={idx} className="flex items-start gap-3 text-foreground/90">
                                        <span className="text-emerald-400 font-bold flex-shrink-0">
                                            {idx + 1}.
                                        </span>
                                        <span>{t}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                </section>

                {/* Related /vs pages — internal linking */}
                <section className="mb-12">
                    <h2 className="font-display text-2xl mb-4">
                        See RivalEye vs. the alternatives
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[
                            "klue",
                            "crayon",
                            "visualping",
                            "kompyte",
                            "prisync",
                            "spyglown",
                        ].map((slug) => (
                            <Link
                                key={slug}
                                href={`/vs/${slug}`}
                                className="block p-3 rounded-md border border-white/10 hover:border-emerald-500/40 hover:bg-white/[0.02] transition-colors"
                            >
                                <p className="text-sm font-medium capitalize">
                                    RivalEye vs {slug}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    See the comparison →
                                </p>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* Free tools section */}
                <section className="mb-12">
                    <h2 className="font-display text-2xl mb-4">
                        Try the free public tracker
                    </h2>
                    <p className="text-foreground/90 mb-4">
                        No signup. Browse competitor pricing snapshots tracked
                        daily by RivalEye users around the world.
                    </p>
                    <Button asChild variant="glow-emerald">
                        <Link href="/track">
                            Browse tracked competitors
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Link>
                    </Button>
                </section>

                {/* Final CTA */}
                <Card className="glass-card border-emerald-500/30">
                    <CardContent className="p-8 text-center">
                        <h2 className="font-display text-2xl mb-2">
                            Set up RivalEye for your {i.name.toLowerCase()} team
                        </h2>
                        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                            Free plan: 1 competitor, 1 region, daily checks. Pro: 5 competitors,
                            4 regions, AI briefs, Slack alerts.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Button asChild variant="glow-emerald" size="lg">
                                <Link href="/signup">
                                    Start free
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
