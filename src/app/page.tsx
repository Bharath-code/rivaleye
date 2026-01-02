import Header from "./components/Header";
import Footer from "./components/Footer";
import { Button } from "@/components/ui/button";
import { DemoAlertPreview } from "@/components/demo";
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
            Pricing Intelligence for Revenue Teams
          </div>

          {/* Headline */}
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl text-foreground leading-[1.1] mb-6">
            Your competitors just changed pricing. <br />
            <span className="text-emerald-400 italic">You found out first.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            RivalEye monitors competitor pricing pages from 8 global regions.
            When they move, you get an <span className="text-foreground font-medium">AI-powered tactical brief</span> — not just an alert.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login">
              <Button size="lg" className="glow-emerald text-base px-8 py-6 gap-2">
                Start Free — No Card Required
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="#demo">
              <Button variant="outline" size="lg" className="text-base px-8 py-6">
                See a Live Alert
              </Button>
            </Link>
          </div>

          {/* Trust Signal */}
          <p className="text-sm text-muted-foreground mt-8">
            Free forever for 1 competitor • Setup in 30 seconds
          </p>
        </div>
      </section>

      {/* Social Proof Bar */}
      <section className="py-8 px-6 border-y border-border bg-muted/20">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-12 text-muted-foreground text-sm font-medium">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Detects changes in &lt;24 hours</span>
          </div>
          <div className="flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-emerald-400" />
            <span>4 key global regions</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>AI explains the "Why"</span>
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
                  Not just alerts. Ammunition.
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  When a competitor shifts their strategy, you receive a
                  judgment report designed for immediate action:
                </p>
                <ul className="mt-6 space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-emerald-400 text-[10px] font-bold">01</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      <strong className="text-foreground">Impact Radius</strong> — Exact analysis of which customers are at risk.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-emerald-400 text-[10px] font-bold">02</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      <strong className="text-foreground">Tactical Plays</strong> — AI-generated sales counter-scripts and retention plays.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-emerald-400 text-[10px] font-bold">03</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      <strong className="text-foreground">Verifiable Proof</strong> — Side-by-side snapshots from multiple global endpoints.
                    </span>
                  </li>
                </ul>
              </div>
              <div className="bg-muted/30 rounded-xl p-6 border border-border relative overflow-hidden group">
                {/* Dot grid decoration */}
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                  <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <pattern id="dotPattern" width="12" height="12" patternUnits="userSpaceOnUse">
                        <circle cx="1" cy="1" r="0.5" fill="currentColor" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#dotPattern)" />
                  </svg>
                </div>

                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase">Live Intelligence</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px] font-medium border border-red-500/20">THREAT DETECTED</span>
                      <span className="text-sm text-foreground">Acme Corp moved Upmarket</span>
                    </div>
                    <div className="text-xs text-muted-foreground pl-3 border-l-2 border-emerald-500/30 py-1 italic">
                      "Moving Pro from $49 to $79. They are conceding the mid-market. Launch retention campaign 'B' now."
                    </div>
                    <div className="flex gap-2 mt-4">
                      <div className="flex-1 bg-muted/50 rounded-lg p-2 text-center border border-border">
                        <div className="text-[9px] text-muted-foreground mb-1 uppercase tracking-tighter">Previous</div>
                        <div className="text-base text-foreground font-mono">$49</div>
                      </div>
                      <div className="text-emerald-400 self-center font-bold">→</div>
                      <div className="flex-1 bg-emerald-500/10 rounded-lg p-2 text-center border border-emerald-500/30">
                        <div className="text-[9px] text-emerald-400 mb-1 uppercase tracking-tighter">Current</div>
                        <div className="text-base text-emerald-400 font-mono font-bold">$79</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Alert Section */}
      <section id="demo" className="py-20 px-6 bg-muted/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl text-foreground mb-4">
              This is not a notification. It&apos;s a playbook.
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              When Acme Corp raises their Pro tier by 61%, you don&apos;t just know — you know exactly what to do.
            </p>
          </div>

          <DemoAlertPreview variant="tactical" />
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl text-foreground mb-4">
              We catch what others miss.
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Price changes are just the beginning. We monitor the signals that reveal strategy.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: LineChart,
                title: "Price Movements",
                desc: "Catch increases, decreases, and sneaky regional discounts before your sales team hears about them from prospects.",
              },
              {
                icon: Zap,
                title: "Plan Restructuring",
                desc: "Know the moment they add enterprise tiers, remove free plans, or bundle features differently.",
              },
              {
                icon: Shield,
                title: "Freemium Gating",
                desc: "High-priority alert when features move behind a paywall — a classic sign they're monetizing harder.",
              },
              {
                icon: Globe2,
                title: "Geo-Pricing Gaps",
                desc: "Uncover hidden discounts in India, Brazil, or EU that they're not advertising publicly.",
              },
              {
                icon: Sparkles,
                title: "Strategic Context",
                desc: "AI explains whether they're moving upmarket, cutting costs, or testing elasticity.",
              },
              {
                icon: Clock,
                title: "Go-to-Market Shifts",
                desc: "'Start Free' → 'Book a Demo' means they're pivoting to sales-led. You should know.",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="glass-card rounded-xl p-8 group hover:border-emerald-500/30 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-6 group-hover:glow-emerald transition-shadow">
                  <feature.icon className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-lg font-display text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Geo-Aware Section */}
      <section className="py-20 px-6 bg-muted/10">
        <div className="max-w-4xl mx-auto">
          <div className="glass-card rounded-2xl p-8 sm:p-12 border-emerald-500/20 relative overflow-hidden">
            {/* Decorative lines */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -mr-16 -mt-16" />

            <div className="flex items-center gap-4 mb-6 relative z-10">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <MapPin className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <div className="text-[10px] text-emerald-400 font-mono font-bold tracking-widest uppercase">Global Sensors</div>
                <h3 className="font-display text-2xl text-foreground">
                  Multipoint Geographic Analysis
                </h3>
              </div>
            </div>

            <p className="text-muted-foreground mb-8 leading-relaxed relative z-10">
              Competitors use IP-based pricing to hide localized strategies.
              RivalEye deployments monitor from 8 global regions simultaneously,
              uncovering hidden discounts and regional test-pricing.
            </p>

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 relative z-10">
              {["🇺🇸 US", "🇬🇧 UK", "🇩🇪 DE", "🇫🇷 FR", "🇮🇳 IN", "🇦🇺 AU", "🇧🇷 BR", "🇯🇵 JP"].map(
                (region) => (
                  <div
                    key={region}
                    className="text-center p-2 rounded-lg bg-muted/30 text-[10px] text-muted-foreground border border-border hover:border-emerald-500/20 transition-colors"
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
            Strategic Investment.
          </h2>
          <p className="text-muted-foreground mb-12">
            Pick the plan that fits your execution speed.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Free */}
            <div className="glass-card rounded-2xl p-8 text-left border-dashed">
              <div className="font-mono text-[10px] text-muted-foreground mb-2 uppercase tracking-widest">Recon Tier</div>
              <div className="text-4xl font-bold text-foreground mb-2">
                $0
                <span className="text-lg font-normal text-muted-foreground">/mo</span>
              </div>
              <p className="text-sm text-muted-foreground mb-8">For early-stage founders.</p>

              <ul className="space-y-4 text-sm text-muted-foreground mb-10">
                {[
                  "1 competitor sensor",
                  "Daily trajectory scans",
                  "Standard email alerts",
                  "Basic diff detection",
                  "7-day history storage",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-emerald-500/50" />
                    {item}
                  </li>
                ))}
              </ul>

              <Link href="/login" className="block">
                <Button variant="outline" className="w-full h-12 text-base">
                  Start Monitoring
                </Button>
              </Link>
            </div>

            {/* Pro */}
            <div className="glass-card rounded-2xl p-8 text-left border-emerald-500/30 relative overflow-hidden saber-border">
              <div className="absolute top-0 right-0 bg-emerald-500 text-background text-[10px] font-bold px-4 py-1 rounded-bl-lg uppercase tracking-wider">
                Recommended
              </div>
              <div className="font-mono text-[10px] text-emerald-400 mb-2 uppercase tracking-widest">Tactical Tier</div>
              <div className="text-4xl font-bold text-foreground mb-2">
                $29
                <span className="text-lg font-normal text-muted-foreground">/mo</span>
              </div>
              <p className="text-sm text-muted-foreground mb-8">For scaling intelligence ops.</p>

              <ul className="space-y-4 text-sm mb-10">
                {[
                  { text: "5 competitor sensors", highlight: false },
                  { text: "Unlimited page depth", highlight: false },
                  { text: "Frequent monitoring scans", highlight: false },
                  { text: "4 Regional sensors (US, EU, IN)", highlight: true },
                  { text: "AI Tactical Briefs", highlight: true },
                  { text: "Visual verification (SVG/Images)", highlight: true },
                  { text: "Unlimited delta history", highlight: false },
                ].map((item, i) => (
                  <li
                    key={i}
                    className={`flex items-center gap-3 ${item.highlight ? "text-foreground font-medium" : "text-muted-foreground"}`}
                  >
                    <Check className="w-4 h-4 text-emerald-500" />
                    {item.text}
                  </li>
                ))}
              </ul>

              <Link href="/login" className="block">
                <Button className="w-full h-12 text-base glow-emerald">
                  Deploy Pro Sensors
                </Button>
              </Link>
            </div>
          </div>

          {/* Enterprise teaser */}
          <div className="mt-12 p-6 rounded-xl bg-muted/20 border border-border inline-block">
            <p className="text-sm text-muted-foreground">
              Need more than 5 competitors?
              <a href="mailto:hello@rivaleye.app" className="text-emerald-400 hover:underline ml-2 font-medium">
                Contact Command for Enterprise
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-4xl sm:text-5xl text-foreground mb-6">
            Your competitors have a pricing strategy. <br />
            <span className="text-emerald-400">Do you have a response?</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-10 leading-relaxed max-w-xl mx-auto">
            Every day you&apos;re not monitoring, you&apos;re flying blind.
            Start free — it takes 30 seconds.
          </p>
          <Link href="/login">
            <Button size="lg" className="glow-emerald text-base px-10 py-8 gap-3">
              Deploy Your First Sensor
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
