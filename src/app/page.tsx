import Header from "./components/Header";
import Footer from "./components/Footer";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Eye,
  Zap,
  Shield,
  ArrowRight,
  Globe2,
  LineChart,
  Bell,
  Check,
  Sparkles,
  Clock,
  MapPin,
} from "lucide-react";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col noise-overlay">
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-24 px-6 relative">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center stagger-children relative">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Competitive intelligence for SaaS founders
          </div>

          {/* Headline */}
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl text-foreground leading-[1.1] mb-6">
            Know when competitors{" "}
            <span className="text-emerald-400 italic">change pricing</span>
            <br />
            before your customers do.
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            RivalEye monitors competitor pricing pages globally and sends{" "}
            <span className="text-foreground font-medium">AI-powered insights</span>{" "}
            when something meaningful changes. Detect price hikes, new plans,
            and regional differences — before they impact your positioning.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login">
              <Button size="lg" className="glow-emerald text-base px-8 py-6 gap-2">
                Start Monitoring Free
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="#features">
              <Button variant="outline" size="lg" className="text-base px-8 py-6">
                See What We Detect
              </Button>
            </Link>
          </div>

          {/* Trust Signal */}
          <p className="text-sm text-muted-foreground mt-8">
            Free forever for 1 competitor • No credit card required
          </p>
        </div>
      </section>

      {/* Social Proof Bar */}
      <section className="py-8 px-6 border-y border-border bg-muted/20">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-8 text-muted-foreground text-sm">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Detects price changes in 24 hours</span>
          </div>
          <div className="flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-emerald-400" />
            <span>8 global regions monitored</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>AI explains why it matters</span>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="glass-card rounded-2xl p-8 sm:p-12">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="font-display text-3xl text-foreground mb-4">
                  The email is the product.
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  When a competitor changes their pricing, you get one calm,
                  accurate email that tells you:
                </p>
                <ul className="mt-4 space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-emerald-400 text-xs font-bold">1</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      <strong className="text-foreground">What changed</strong> — exact before/after comparison
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-emerald-400 text-xs font-bold">2</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      <strong className="text-foreground">Why it matters</strong> — AI-powered market context
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-emerald-400 text-xs font-bold">3</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      <strong className="text-foreground">Visual proof</strong> — side-by-side screenshots
                    </span>
                  </li>
                </ul>
              </div>
              <div className="bg-muted/30 rounded-xl p-6 border border-border">
                <div className="flex items-center gap-2 mb-4">
                  <Bell className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-muted-foreground">PRICING ALERT</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px] font-medium">HIGH</span>
                    <span className="text-sm text-foreground">📈 Acme raised Pro from $49 → $79/mo</span>
                  </div>
                  <div className="text-xs text-muted-foreground pl-2 border-l-2 border-emerald-500/30">
                    This 61% increase suggests they&apos;re moving upmarket...
                  </div>
                  <div className="flex gap-2 mt-4">
                    <div className="flex-1 bg-muted/50 rounded p-2 text-center">
                      <div className="text-[10px] text-muted-foreground">BEFORE</div>
                      <div className="text-sm text-foreground">$49</div>
                    </div>
                    <div className="text-emerald-400 self-center">→</div>
                    <div className="flex-1 bg-emerald-500/10 rounded p-2 text-center border border-emerald-500/30">
                      <div className="text-[10px] text-emerald-400">AFTER</div>
                      <div className="text-sm text-emerald-400 font-medium">$79</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl text-foreground mb-4">
              What RivalEye detects
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Not just price changes — we catch the strategic moves that matter.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Detection Types */}
            {[
              {
                icon: LineChart,
                emoji: "📈",
                title: "Price Changes",
                desc: "Increases, decreases, and new pricing structures",
              },
              {
                icon: Zap,
                emoji: "➕",
                title: "New Plans",
                desc: "When they add tiers, bundles, or enterprise options",
              },
              {
                icon: Shield,
                emoji: "🚨",
                title: "Free Tier Removal",
                desc: "Critical alert when competitors gate features",
              },
              {
                icon: Globe2,
                emoji: "🌍",
                title: "Regional Pricing",
                desc: "Detect different prices for US, EU, UK, India, etc.",
              },
              {
                icon: Sparkles,
                emoji: "⭐",
                title: "Promoted Plans",
                desc: 'Spot when they push a specific tier as "Most Popular"',
              },
              {
                icon: Clock,
                emoji: "🔄",
                title: "CTA Changes",
                desc: '"Start Free" to "Contact Sales" signals strategy shifts',
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="glass-card rounded-xl p-6 group hover:border-emerald-500/30 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:glow-emerald transition-shadow">
                    <span className="text-lg">{feature.emoji}</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {feature.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Geo-Aware Section */}
      <section className="py-20 px-6 bg-muted/10">
        <div className="max-w-4xl mx-auto">
          <div className="glass-card rounded-2xl p-8 sm:p-12 border-emerald-500/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <div className="text-xs text-emerald-400 font-mono">NEW</div>
                <h3 className="font-display text-xl text-foreground">
                  Geo-Aware Pricing Intelligence
                </h3>
              </div>
            </div>

            <p className="text-muted-foreground mb-6">
              Many SaaS companies charge different prices based on location.
              RivalEye monitors your competitors from multiple regions —
              so you catch regional pricing differences and localized strategies.
            </p>

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
              {["🇺🇸 US", "🇬🇧 UK", "🇩🇪 DE", "🇫🇷 FR", "🇮🇳 IN", "🇦🇺 AU", "🇧🇷 BR", "🇯🇵 JP"].map(
                (region) => (
                  <div
                    key={region}
                    className="text-center p-2 rounded-lg bg-muted/30 text-xs text-muted-foreground"
                  >
                    {region}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display text-4xl text-foreground mb-4">
            Simple pricing. No tricks.
          </h2>
          <p className="text-muted-foreground mb-12">
            Free is complete for side projects. Pro unlocks everything.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Free */}
            <div className="glass-card rounded-xl p-8 text-left">
              <div className="font-mono text-sm text-muted-foreground mb-2">FREE</div>
              <div className="text-4xl font-bold text-foreground mb-2">
                $0
                <span className="text-lg font-normal text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Perfect to try it out</p>

              <ul className="space-y-3 text-sm text-muted-foreground mb-8">
                {[
                  "1 competitor",
                  "1 pricing page",
                  "Daily checks",
                  "Email alerts",
                  "What changed (descriptive)",
                  "7-day alert history",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>

              <Link href="/login">
                <Button variant="outline" className="w-full">
                  Get Started Free
                </Button>
              </Link>
            </div>

            {/* Pro */}
            <div className="glass-card rounded-xl p-8 text-left border-emerald-500/30 relative overflow-hidden saber-border">
              <div className="absolute top-0 right-0 bg-emerald-500 text-background text-xs font-bold px-3 py-1 rounded-bl-lg">
                POPULAR
              </div>
              <div className="font-mono text-sm text-emerald-400 mb-2">PRO</div>
              <div className="text-4xl font-bold text-foreground mb-2">
                $29
                <span className="text-lg font-normal text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">For serious competitors</p>

              <ul className="space-y-3 text-sm mb-8">
                {[
                  { text: "5 competitors", highlight: false },
                  { text: "Unlimited pages per competitor", highlight: false },
                  { text: "Hourly checks", highlight: false },
                  { text: "8 global regions", highlight: true },
                  { text: "AI insights: Why it matters", highlight: true },
                  { text: "Side-by-side screenshots", highlight: true },
                  { text: "Unlimited alert history", highlight: false },
                  { text: "Priority support", highlight: false },
                ].map((item, i) => (
                  <li
                    key={i}
                    className={`flex items-center gap-2 ${item.highlight ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    <Check className="w-4 h-4 text-emerald-400" />
                    {item.text}
                  </li>
                ))}
              </ul>

              <Link href="/login">
                <Button className="w-full glow-emerald">
                  Start Pro Trial
                </Button>
              </Link>
            </div>
          </div>

          {/* Enterprise teaser */}
          <p className="text-sm text-muted-foreground mt-8">
            Need more than 5 competitors?{" "}
            <a href="mailto:hello@rivaleye.app" className="text-emerald-400 hover:underline">
              Contact us for Enterprise
            </a>
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-4xl text-foreground mb-4">
            Stop being the last to know.
          </h2>
          <p className="text-muted-foreground mb-8">
            Your competitors are watching you. Start watching back.
          </p>
          <Link href="/login">
            <Button size="lg" className="glow-emerald text-base px-8 py-6 gap-2">
              Start Monitoring Free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
