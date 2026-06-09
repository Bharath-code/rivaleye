import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles, MapPin, TrendingUp, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import competitorsData from "@/data/competitors.json";
import industriesData from "@/data/industries.json";

/**
 * /track/[competitor]/[region] — Programmatic SEO landing pages
 *
 * 15 pages shipped (5 competitors × 3 regions).
 *
 * Examples:
 *   /track/stripe-pricing/in-india
 *   /track/notion-pricing/in-eu
 *   /track/figma-pricing/in-us
 *
 * SEO targets:
 *   - "track [competitor] pricing in [region]" (~200-500/mo per combo)
 *   - "[competitor] pricing in [region]"
 *   - "[competitor] [region] pricing"
 *
 * Strategy: these are landing pages that:
 *  1. Describe what RivalEye would track for this combo
 *  2. Render the live public tracker at /track/[slug] if data exists
 *  3. Show a strong "start tracking" CTA otherwise
 *  4. Link to related /vs and /for pages
 *
 * The slug format: `${competitorName}-pricing` and region slugs from
 * industries.json (in-india, in-eu, in-us, in-brazil, in-latin-america).
 */

// Top 5 SaaS competitors we'll target (matches PATH_TO_10 plan)
const TARGET_COMPETITORS = [
    { slug: "stripe", name: "Stripe", tagline: "Payments infrastructure for the internet" },
    { slug: "notion", name: "Notion", tagline: "Connected workspace for teams" },
    { slug: "figma", name: "Figma", tagline: "Collaborative interface design" },
    { slug: "linear", name: "Linear", tagline: "Issue tracking for high-performance teams" },
    { slug: "vercel", name: "Vercel", tagline: "Frontend cloud platform" },
];

const regions = industriesData.regions;

type PageParams = { competitor: string; region: string };

function isValidCompetitor(slug: string) {
    return TARGET_COMPETITORS.some((c) => c.slug === slug);
}

function isValidRegion(slug: string) {
    return regions.some((r) => r.slug === slug);
}

function getCompetitor(slug: string) {
    return TARGET_COMPETITORS.find((c) => c.slug === slug);
}

function getRegion(slug: string) {
    return regions.find((r) => r.slug === slug);
}

export function generateStaticParams() {
    const params: PageParams[] = [];
    for (const c of TARGET_COMPETITORS) {
        for (const r of regions) {
            params.push({ competitor: c.slug, region: r.slug });
        }
    }
    return params;
}

export async function generateMetadata(
    { params }: { params: Promise<PageParams> }
): Promise<Metadata> {
    const { competitor, region } = await params;
    const c = getCompetitor(competitor);
    const r = getRegion(region);
    if (!c || !r) return { title: "Page not found" };

    return {
        title: `Track ${c.name} pricing in ${r.name} (live, daily, free) — RivalEye`,
        description: `Monitor ${c.name} pricing in ${r.name}. Live ${r.currency} snapshots, daily change detection, AI-generated tactical briefs. Free public tracker.`,
        keywords: [
            `${c.name} pricing in ${r.name}`,
            `${c.name} ${r.name} pricing`,
            `track ${c.name} pricing ${r.name}`,
            `${c.name} ${r.code} pricing`,
        ],
        alternates: { canonical: `/track/${c.slug}-pricing/${r.slug}` },
        openGraph: {
            title: `${c.name} pricing in ${r.name} — live tracker`,
            description: `Daily pricing snapshots, change alerts, and AI briefs for ${c.name} in ${r.name}.`,
            type: "website",
            url: `/track/${c.slug}-pricing/${r.slug}`,
        },
    };
}

export default async function TrackRegionPage(
    { params }: { params: Promise<PageParams> }
) {
    const { competitor, region } = await params;
    const c = getCompetitor(competitor);
    const r = getRegion(region);
    if (!c || !r) notFound();

    return (
        <div className="min-h-screen bg-background text-foreground">
            <main className="max-w-4xl mx-auto px-6 py-16">
                <header className="mb-12">
                    <Link
                        href="/track"
                        className="text-xs text-muted-foreground hover:text-emerald-400 mb-4 inline-block uppercase tracking-widest"
                    >
                        ← All tracked competitors
                    </Link>

                    <div className="flex items-center gap-3 mb-3">
                        <h1 className="font-display text-4xl md:text-5xl">
                            {c.name} pricing in {r.name}
                        </h1>
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                            {r.code}
                        </Badge>
                    </div>

                    <p className="text-lg text-muted-foreground max-w-2xl">
                        {c.tagline}. We track {c.name}'s {r.name.toLowerCase()}{" "}
                        pricing daily and alert you the moment something changes.
                        Free public tracker below.
                    </p>
                </header>

                {/* Live tracker CTA — links to actual tracker */}
                <section className="mb-12">
                    <Card className="glass-card border-emerald-500/30">
                        <CardContent className="p-8 text-center">
                            <Sparkles className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
                            <h2 className="font-display text-2xl mb-2">
                                {c.name} {r.name} live pricing
                            </h2>
                            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                                Click below to see the current pricing snapshot for
                                {" "}{c.name} in {r.name}, plus historical changes
                                and AI-generated tactical briefs.
                            </p>
                            <Button asChild variant="glow-emerald" size="lg">
                                <Link href={`/track/${c.slug}-com`}>
                                    View live {c.name} pricing
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </section>

                {/* What you'd see */}
                <section className="mb-12">
                    <h2 className="font-display text-2xl mb-4">
                        What you get with RivalEye for {c.name}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="glass-card">
                            <CardContent className="p-5 flex items-start gap-3">
                                <TrendingUp className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="font-medium mb-1">
                                        Daily pricing snapshots
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        We screenshot {c.name}'s {r.name.toLowerCase()}{" "}
                                        pricing page every day and extract structured
                                        data using Vision AI.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="glass-card">
                            <CardContent className="p-5 flex items-start gap-3">
                                <Sparkles className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="font-medium mb-1">
                                        AI tactical briefs
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        When something changes, you get a
                                        what-changed / why-it-matters /
                                        what-to-consider-doing brief in your inbox.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="glass-card">
                            <CardContent className="p-5 flex items-start gap-3">
                                <MapPin className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="font-medium mb-1">
                                        Regional pricing tracking
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        {r.name} is one of 4 regions RivalEye
                                        tracks. Compare {c.name}'s {r.currency}{" "}
                                        pricing vs US/EU/India in one view.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="glass-card">
                            <CardContent className="p-5 flex items-start gap-3">
                                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="font-medium mb-1">
                                        Historical change timeline
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        See every pricing change {c.name} has
                                        made in the last 90 days. Spot patterns
                                        their team doesn't want you to see.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </section>

                {/* Regional notes */}
                <section className="mb-12">
                    <h2 className="font-display text-2xl mb-4">
                        About {c.name} pricing in {r.name}
                    </h2>
                    <Card className="glass-card">
                        <CardContent className="p-5">
                            <p className="text-foreground/90 leading-relaxed">
                                {r.notes} For {c.name} specifically, this means
                                you'll see pricing displayed in {r.currency} and
                                localized for the {r.name} market. RivalEye
                                tracks all 4 regions simultaneously so you can
                                spot regional arbitrage opportunities (e.g. if
                                {" "}{c.name} prices {r.name.toLowerCase()}{" "}
                                significantly differently from the US).
                            </p>
                        </CardContent>
                    </Card>
                </section>

                {/* Related searches — internal links to other track pages */}
                <section className="mb-12">
                    <h2 className="font-display text-2xl mb-4">
                        Track {c.name} in other regions
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {regions
                            .filter((otherR) => otherR.slug !== r.slug)
                            .map((otherR) => (
                                <Link
                                    key={otherR.slug}
                                    href={`/track/${c.slug}-pricing/${otherR.slug}`}
                                    className="block p-3 rounded-md border border-white/10 hover:border-emerald-500/40 hover:bg-white/[0.02] transition-colors"
                                >
                                    <p className="text-sm font-medium">
                                        {c.name} pricing in {otherR.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {otherR.currency} · live tracker →
                                    </p>
                                </Link>
                            ))}
                    </div>
                </section>

                {/* Related: other competitors in this region */}
                <section className="mb-12">
                    <h2 className="font-display text-2xl mb-4">
                        Other {r.name} pricing trackers
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {TARGET_COMPETITORS
                            .filter((otherC) => otherC.slug !== c.slug)
                            .map((otherC) => (
                                <Link
                                    key={otherC.slug}
                                    href={`/track/${otherC.slug}-pricing/${r.slug}`}
                                    className="block p-3 rounded-md border border-white/10 hover:border-emerald-500/40 hover:bg-white/[0.02] transition-colors"
                                >
                                    <p className="text-sm font-medium">
                                        {otherC.name} in {r.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Live tracker →
                                    </p>
                                </Link>
                            ))}
                    </div>
                </section>

                {/* Final CTA */}
                <Card className="glass-card border-emerald-500/30">
                    <CardContent className="p-8 text-center">
                        <h2 className="font-display text-2xl mb-2">
                            Get {c.name} alerts in {r.name} daily
                        </h2>
                        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                            Free plan: track 1 competitor, 1 region. Pro:
                            5 competitors, 4 regions, AI briefs, Slack alerts.
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
