import Header from "./components/Header";
import Footer from "./components/Footer";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Eye, Zap, Shield, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col dot-grid">
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center stagger-children">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Competitive intelligence for indie founders
          </div>

          {/* Headline */}
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl text-foreground leading-[1.1] mb-6">
            Know when competitors{" "}
            <span className="text-emerald-400 italic">move</span>
            <br />
            before it&apos;s too late.
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            RivalEye monitors competitor pricing pages and sends you
            AI-powered insights when something meaningful changes.
            Not just what changed — <span className="text-foreground">what it means</span>.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/dashboard">
              <Button size="lg" className="glow-emerald text-base px-8 py-6 gap-2">
                Start Monitoring Free
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button variant="outline" size="lg" className="text-base px-8 py-6">
                See How It Works
              </Button>
            </Link>
          </div>

          {/* Trust Signal */}
          <p className="text-sm text-muted-foreground mt-8">
            Free forever for 1 competitor • No credit card required
          </p>
        </div>
      </section>

      {/* The Promise */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <div className="glass-card rounded-2xl p-8 sm:p-12 text-center">
            <h2 className="font-display text-3xl sm:text-4xl text-foreground mb-4">
              The email is the product.
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              When your competitor changes their pricing or positioning, you get one
              calm, accurate email that tells you what happened, why it might matter,
              and what you could consider doing about it.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl text-foreground mb-4">
              How RivalEye works
            </h2>
            <p className="text-muted-foreground">
              Three steps to competitive clarity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="glass-card rounded-xl p-8 group hover:border-emerald-500/30 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-6 group-hover:glow-emerald transition-shadow">
                <Eye className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="font-mono text-sm text-emerald-400 mb-2">01</div>
              <h3 className="font-display text-xl text-foreground mb-3">
                Add a competitor
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Drop in their pricing page URL. We take a snapshot immediately and
                start monitoring daily.
              </p>
            </div>

            {/* Step 2 */}
            <div className="glass-card rounded-xl p-8 group hover:border-emerald-500/30 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-6 group-hover:glow-emerald transition-shadow">
                <Zap className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="font-mono text-sm text-emerald-400 mb-2">02</div>
              <h3 className="font-display text-xl text-foreground mb-3">
                We detect changes
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Our AI filters out noise — footer updates, dates, grammar fixes —
                and only flags what actually matters.
              </p>
            </div>

            {/* Step 3 */}
            <div className="glass-card rounded-xl p-8 group hover:border-emerald-500/30 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-6 group-hover:glow-emerald transition-shadow">
                <Shield className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="font-mono text-sm text-emerald-400 mb-2">03</div>
              <h3 className="font-display text-xl text-foreground mb-3">
                Get insight, not noise
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                One email with: what changed, why it may matter, and what to consider.
                That&apos;s it. No dashboard worship.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Free vs Pro */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display text-4xl text-foreground mb-4">
            Simple pricing. No tricks.
          </h2>
          <p className="text-muted-foreground mb-12">
            Free is complete for light users. Pro is for when you&apos;re ready to scale.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Free */}
            <div className="glass-card rounded-xl p-8 text-left">
              <div className="font-mono text-sm text-muted-foreground mb-2">FREE</div>
              <div className="text-3xl font-bold text-foreground mb-6">$0<span className="text-lg font-normal text-muted-foreground">/month</span></div>
              <ul className="space-y-3 text-sm text-muted-foreground mb-8">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> 1 competitor
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> 1 monitored page
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> Daily checks
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> Email alerts
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> What changed (descriptive)
                </li>
              </ul>
              <Link href="/dashboard">
                <Button variant="outline" className="w-full">Get Started</Button>
              </Link>
            </div>

            {/* Pro */}
            <div className="glass-card rounded-xl p-8 text-left border-emerald-500/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-emerald-500 text-background text-xs font-bold px-3 py-1 rounded-bl-lg">
                COMING SOON
              </div>
              <div className="font-mono text-sm text-emerald-400 mb-2">PRO</div>
              <div className="text-3xl font-bold text-foreground mb-6">$19<span className="text-lg font-normal text-muted-foreground">/month</span></div>
              <ul className="space-y-3 text-sm text-muted-foreground mb-8">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> Unlimited competitors
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> Unlimited pages
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> Hourly checks
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> <strong className="text-foreground">Why it matters</strong> (interpretation)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> <strong className="text-foreground">What to do</strong> (actions)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> Full alert history
                </li>
              </ul>
              <Button className="w-full" disabled>Join Waitlist</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-4xl text-foreground mb-4">
            Stop being the last to know.
          </h2>
          <p className="text-muted-foreground mb-8">
            Start monitoring your first competitor in 30 seconds.
          </p>
          <Link href="/dashboard">
            <Button size="lg" className="glow-emerald text-base px-8 py-6 gap-2">
              Start Free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
