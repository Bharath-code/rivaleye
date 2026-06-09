import Link from "next/link";
import { ArrowRight, Globe } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import industriesData from "@/data/industries.json";
import { createClient } from "@supabase/supabase-js";

/**
 * /track — Index of all programmatic track pages
 *
 * Hub for:
 *  - "Live now" — actual tracked competitors pulled from Supabase
 *  - 15 programmatic pages (/track/[competitor]-pricing/[region])
 *  - 5 free public pages (/track/[slug] from real user data)
 *
 * Internal-linking backbone for the /track/* cluster.
 */

const TARGET_COMPETITORS = [
    { slug: "stripe", name: "Stripe" },
    { slug: "notion", name: "Notion" },
    { slug: "figma", name: "Figma" },
    { slug: "linear", name: "Linear" },
    { slug: "vercel", name: "Vercel" },
];

const regions = industriesData.regions;

export const revalidate = 3600; // 1 hour

export default async function TrackIndex() {
    // Pull live tracked competitors from Supabase
    let liveCompetitors: Array<{ name: string; slug: string }> = [];
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const { data } = await supabase
            .from("competitors")
            .select("name, url")
            .eq("status", "active")
            .limit(50);

        if (data) {
            liveCompetitors = data
                .map((c) => {
                    try {
                        const host = new URL(c.url).hostname.toLowerCase().replace(/\./g, "-");
                        return { name: c.name, slug: host };
                    } catch {
                        return null;
                    }
                })
                .filter((c): c is { name: string; slug: string } => c !== null);
        }
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <main className="max-w-6xl mx-auto px-6 py-16">
                <header className="mb-12">
                    <Link
                        href="/"
                        className="text-xs text-muted-foreground hover:text-emerald-400 mb-4 inline-block uppercase tracking-widest"
                    >
                        ← RivalEye
                    </Link>
                    <h1 className="font-display text-4xl md:text-5xl mb-4 leading-tight">
                        Browse tracked competitors
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl">
                        Live public trackers for {TARGET_COMPETITORS.length} top
                        SaaS tools across {regions.length} regions — and
                        {" "}{liveCompetitors.length}+ real trackers from our users.
                        No signup required.
                    </p>
                </header>

                {/* Live user-track section */}
                {liveCompetitors.length > 0 && (
                    <section className="mb-12">
                        <h2 className="font-display text-2xl mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Live now ({liveCompetitors.length})
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {liveCompetitors.map((c) => (
                                <Link
                                    key={c.slug}
                                    href={`/track/${c.slug}`}
                                    className="block p-3 rounded-md border border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-colors"
                                >
                                    <p className="text-sm font-medium">{c.name}</p>
                                    <p className="text-xs text-emerald-400">
                                        Live tracker →
                                    </p>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* Programmatic SEO pages — by competitor */}
                <section className="mb-12">
                    <h2 className="font-display text-2xl mb-4 flex items-center gap-2">
                        <Globe className="w-5 h-5 text-emerald-400" />
                        By competitor × region (15 pages)
                    </h2>
                    <div className="space-y-4">
                        {TARGET_COMPETITORS.map((c) => (
                            <Card key={c.slug} className="glass-card">
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between gap-4 mb-3">
                                        <h3 className="font-display text-lg">
                                            {c.name}
                                        </h3>
                                        <Badge variant="outline" className="text-[10px]">
                                            {regions.length} regions
                                        </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                        {regions.map((r) => (
                                            <Link
                                                key={r.slug}
                                                href={`/track/${c.slug}-pricing/${r.slug}`}
                                                className="block p-2 rounded border border-white/10 hover:border-emerald-500/40 hover:bg-white/[0.02] transition-colors"
                                            >
                                                <p className="text-xs font-medium">
                                                    {r.name}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    {r.currency} →
                                                </p>
                                            </Link>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>

                {/* CTA */}
                <Card className="glass-card border-emerald-500/30">
                    <CardContent className="p-8 text-center">
                        <h2 className="font-display text-2xl mb-2">
                            Want to track a competitor we don't have yet?
                        </h2>
                        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                            Add any URL and we'll start tracking it within 60
                            seconds. Free plan covers 1 competitor.
                        </p>
                        <Link
                            href="/signup"
                            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-black font-medium px-6 py-3 rounded-md transition-colors"
                        >
                            Start tracking free
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
