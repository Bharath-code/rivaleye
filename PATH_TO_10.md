# RivalEye: Path to All 10/10

## Distribution: 1/10 → 10/10 (the actual game)

**Week 1:**
- **Kill 19 projects.** Archive them to `~/archived/`. Delete from active view. Physical removal = mental removal.
- **Buy 5 domains for SEO**: `competitorwatch.io`, `pricetracker.dev`, `saas-radar.com`, `competitorspy.ai`, `startupradar.io` → all redirect to `rivaleye.com/<topic>` with unique content.
- **Write 30 SEO pages** (programmatic):
  - `/vs/[competitor]` — 50 pages (RivalEye vs Klue, vs Crayon, vs Visualping, vs SpyGlow, vs RivalReport, vs Kompyte, vs Klue, etc.)
  - `/for/[industry]` — 20 pages (RivalEye for fintech, for devtools, for agencies, etc.)
  - `/track/[competitor]/[region]` — 100 pages (Track Stripe pricing in India, Track Notion in EU, etc.)
  - Index for "competitor pricing tracker" / "AI competitive intelligence" keywords.
- **Ship "Free Public Competitor Tracker"** — no signup required, 1 URL, public report page. Pure top-of-funnel. This is your PH launch.
- **List on G2, Capterra, GetApp, SaaSHub, AlternativeTo, Product Hunt** (build 200-email supporter list first).
- **Cold DM 10 founders/day on LinkedIn** for 60 days straight. 600 DMs = 30 calls = 10 customers.
- **Post 1 build-in-public thread/day on X** about competitor moves you find. Each one is a free demo.
- **Submit to 30 directories** (IndieHackers, BetaList, MicroConf community, etc.).

**Tools to use:** `programmatic-seo` skill, `directory-submissions` skill, `cold-email` skill, `launch-strategy` skill.

---

## Founder focus: 3/10 → 10/10

- **One calendar block per day** for RivalEye only. No other project files open.
- **Hire a VA ($300/mo)** to handle onboarding, support, and demo scheduling.
- **Hire an SDR ($500/mo)** in Month 2 to do 50 LinkedIn DMs/day.
- **Weekly commitment ritual:** Sunday night, write the 3 things you'll ship this week. Friday, grade yourself.
- **No new side projects for 12 months.** Put it in writing. Tell your future self.
- **Find 1 founder accountability partner** (YC community, MicroConf Slack) for weekly check-ins.
- **Move payments to Stripe revenue recognition** so you see real MRR daily.

---

## Pricing: 6.5/10 → 10/10

**Ship all of this in 2 weeks:**

| Tiers | Price | Includes |
|---|---|---|
| Free | $0 | 1 competitor, 1 region, daily, 7-day history |
| **Starter** (NEW) | $29/mo | 3 competitors, 2 regions, AI briefs, 30-day history |
| Pro (raised) | $79/mo | 10 competitors, 4 regions, Slack, unlimited history |
| **Team** (NEW) | $199/mo | 25 competitors, 5 seats, API, priority queue, audit log |
| **Enterprise** (NEW) | Custom | SSO, SOC 2, unlimited, SLA, dedicated CSM |

**Plus:**
- 14-day free trial, no card
- Annual billing: 2 months free
- Usage overage: $15/extra competitor past cap
- **Switch Dodo → Stripe** (use Stripe Checkout + Customer Portal). Dodo loses 8-12% at checkout.
- A/B test $79 vs $99 vs $129 Pro tier in Month 3.
- Annual-only discount badge on pricing page.

**Code changes:** `src/lib/billing/featureFlags.ts` add 3 tiers; `src/lib/billing/plans.ts` NEW; update `featureFlags.ts:25-71` schema.

---

## UI/UX: 7/10 → 10/10

**Landing page (5 hours):**
- Replace hero text-only with live `DemoAlertPreview` component (already built at `src/components/demo/`).
- Remove fabricated stats ("500+ pages monitored") → replace with "Track 1 free, forever" or your real numbers.
- Add real customer logos (use the "Pilot 10 customers" from your 100M plan).
- Add `?` keyboard shortcut → surfaces `useKeyboardShortcuts` modal.
- Add `Testimonials` section with 3 real quotes from your first 10 customers.
- Add `Pricing` section above the fold (currently buried).

**Dashboard refactor (40 hours, the big one):**
- Split `src/app/dashboard/page.tsx:1` (899 LOC) into:
  - `page.tsx` — server component, fetches initial data
  - `CompetitorsList.tsx` — RSC with Suspense
  - `AlertsFeed.tsx` — RSC with streaming
  - `MarketRadarWidget.tsx` — client with dynamic import
  - `AddCompetitorForm.tsx` — client dialog
- Replace `useState` soup with **TanStack Query** for all server state. Delete 200+ lines of fetch logic.
- Add `loading.tsx` + `error.tsx` + `not-found.tsx` per route.
- Wire `DashboardSkeleton` to every data fetch.
- Add **"First alert" celebration modal** with confetti when first alert fires (retainment).
- Add **mobile responsive** dashboard (verify with Chrome DevTools mobile view).
- Add **export to PDF/CSV** for any chart/table.
- **Empty state library** for: no competitors, no alerts, no data yet. Make empty states sell the upgrade.

**Design polish:**
- Audit all emerald-on-dark text for WCAG AA (4.5:1 minimum).
- Add `prefers-reduced-motion` respect for GSAP animations.
- Add focus rings to every interactive element.
- Add skip-to-content link.
- Add `aria-live` regions for dynamic alerts.

---

## Code quality: 7.5/10 → 10/10

**Day 1 fixes (real bugs):**
1. `src/lib/quotas.ts:138` — fix `incrementManualCheckCount`. Currently:
   ```ts
   await supabase.from("users").update({ manual_checks_today: supabase.rpc("increment", { x: 1 }) }).eq("id", userId);
   ```
   Should be:
   ```ts
   const { error } = await supabase.rpc("increment_manual_check_count", { user_id: userId });
   if (error) throw error;
   ```
   Add the corresponding `supabase/migrations/005_increment_manual_check.sql`:
   ```sql
   CREATE OR REPLACE FUNCTION increment_manual_check_count(user_id UUID)
   RETURNS void AS $$
   BEGIN UPDATE users SET manual_checks_today = manual_checks_today + 1 WHERE id = user_id;
   END; $$ LANGUAGE plpgsql;
   ```

2. `src/lib/auth.ts:16` — change `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (matches `.env.example`).

3. `vitest.config.ts:13` — `coverage.include` includes `**/__tests__/**` while `exclude` excludes them. Remove the include glob, keep exclude.

4. `src/lib/quotas.ts:42,61` — remove `(limits as any).manualChecksPerDay`. Add field to `FeatureFlags` interface in `src/lib/billing/featureFlags.ts:9-23`. Type-safe.

**Structural improvements:**
- Add **GitHub Actions** (`.github/workflows/ci.yml`): lint + typecheck + test on every PR.
- Add **structured logging** (Pino). Replace every `console.error` with `logger.error({ context, err })`.
- Add **Sentry** for error tracking (free tier).
- Extract magic numbers → `src/lib/config.ts`:
  ```ts
  export const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
  export const GLOBAL_MAX_DAILY_CRAWLS = 100_000;
  export const RATE_LIMITS = { ... } as const;
  ```
- Add **dependency scanning** via Dependabot + `npm audit --audit-level=high` in CI.
- Add **Prettier** + `eslint --fix` on pre-commit (Husky + lint-staged).
- Add **`@types/turnstile`**, **`@types/dompurify`** where missing.
- Add **`zod`** for API input validation at every route entry point.
- Add **OpenAPI spec generation** from API routes.
- Refactor `src/lib/utils.ts` (6 lines) → extract common helpers (formatters, date utils, currency formatters, debounce).
- **Delete 25 of 30 docs in `docs/`**. Keep only: `README.md`, `PRICING_ANALYSIS_EXECUTIVE_SUMMARY.md`, `SYSTEM_OVERVIEW.md`, `TRIGGER_SETUP.md`, `supabase/schema.sql`. Move rest to a Notion/wiki.
- Add **JSDoc** to every exported function (current 30% coverage).
- Add **Storybook** for shared components (`src/components/ui/`).

---

## Performance: 7/10 → 10/10

**Database (most impactful):**
- Add indexes in new `migrations/006_perf_indexes.sql`:
  ```sql
  CREATE INDEX CONCURRENTLY idx_pricing_snapshots_competitor_taken 
    ON pricing_snapshots(competitor_id, taken_at DESC);
  CREATE INDEX CONCURRENTLY idx_techstack_competitor 
    ON techstack(competitor_id);
  CREATE INDEX CONCURRENTLY idx_branding_competitor 
    ON branding(competitor_id);
  CREATE INDEX CONCURRENTLY idx_performance_competitor_taken 
    ON performance(competitor_id, taken_at DESC);
  CREATE INDEX CONCURRENTLY idx_alerts_competitor_meaningful_created 
    ON alerts(competitor_id, is_meaningful, created_at DESC) 
    WHERE is_meaningful = true;
  CREATE INDEX CONCURRENTLY idx_users_subscription_status 
    ON users(subscription_status) WHERE subscription_status = 'active';
  ```
- Add **Supabase connection pooler** (PgBouncer) for serverless.
- Add **Redis (Upstash)** for hot data: latest snapshot per competitor, daily usage counters.

**Frontend:**
- Add **Vercel Edge caching** on landing page: `export const revalidate = 3600;` in `src/app/page.tsx:31`.
- Add **ISR** for `/vs/*` and `/track/*` pages.
- Convert `src/app/dashboard/page.tsx:1` to **RSC + Suspense** (covered above).
- Dynamic import GSAP + Lenis only on client (you already do this with `"use client"`, but `import gsap` pulls full bundle).
- Add **next/image** for all images (Sharp already in deps).
- Use **React.lazy** for `AnalysisResultModal`, `OnboardingWizard` (heavy components).
- Add **service worker** for offline dashboard view.

**Backend (trigger.dev):**
- Move Playwright work to a **dedicated worker pool** (not the same queue as AI calls).
- Add **batch processing** for daily analysis (group by region, scrape 20 sites in parallel, single AI call per region).
- Add **adaptive check frequency**: only check pages that have changed in the last 7 days daily. Stable pages → weekly.
- **Cache Gemini responses** by URL+hash for 24h.

**Observability:**
- Add **Vercel Analytics** + **Speed Insights** (free).
- Add **Lighthouse CI** in GitHub Actions to catch regressions.

---

## Security: 7.5/10 → 10/10

**Blockers to enterprise (build in 90 days):**
- **SOC 2 Type 1** — use `compliance-automation` skill. Use Drata or Vanta ($8K-15K/yr). Worth it at $30K+ ARR.
- **SSO/SAML** — use WorkOS ($25/mo for B2B) instead of building. 2 days of integration.
- **2FA** — Supabase Auth has this built in. Enable in dashboard, force for Team tier+.
- **Audit log** — add `audit_log` table + Supabase triggers on `competitors`, `users`, `alerts`:
  ```sql
  CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users see own audit log" ON audit_log 
    FOR SELECT USING (auth.uid() = user_id);
  ```

**Quick wins (1-2 days each):**
- Audit `src/lib/urlValidator.ts` — verify it blocks 169.254.x.x, 10.x.x.x, 172.16-31.x.x, 127.0.0.1, ::1, 0.0.0.0, .internal, .local. Add tests.
- Add **Zod validation** to every API route input.
- **Sanitize Supabase errors** before returning to client. Catch block in every route.
- Add **CSP header** in `next.config.ts`:
  ```ts
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; ..." },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ]
    }];
  }
  ```
- Add **rate limit on all routes** (you have it on some, not all).
- Add **Dodo webhook signature verification** if not done (`src/app/api/webhook/`).
- Add **Dependabot** + `npm audit` in CI.
- Add **2FA enforcement** for Team+ tiers.
- Add **DPA + Privacy Policy + ToS** pages (required for EU customers).
- **Data export** (GDPR Article 20) — `/api/user/export` returns all user data.
- **Account deletion** (GDPR Article 17) — `/api/user/delete` with 30-day grace.

---

## Product viability: 9/10 → 10/10

**Ship in 90 days:**
- **AI Visibility Monitor** — track ChatGPT/Perplexity/Claude/Google AI Overview citations for "best [your category] tools" prompts. Sample 50 prompts per competitor weekly. This is the 2026 wedge.
- **Public API** with OpenAPI spec + SDK (TypeScript first).
- **Slack app** (real one, OAuth, `/rivaleye watch` slash command).
- **Zapier/Make integration**.
- **Battlecard export** (PDF + Notion + Confluence).
- **Win/Loss tracking** — simple CRM-lite: log deal outcomes, get auto-categorized.
- **Mobile app** OR **PWA** (dashboard responsive is fine for now).
- **Webhook out** for "alert published" events.
- **Public report generator** with viral shareable URLs.

**The killer feature that makes you 10/10:** "AI Watchdog Agent" — set a goal ("alert me if any competitor drops below $30/mo") and the agent proactively monitors, alerts, and even drafts counter-moves (sales email, blog post, product change) without you asking. Klue and Crayon don't have this. ChatGPT wrappers can't do it cheaply.

---

## Market timing: 8/10 → 10/10

You can't change the market, but you can position perfectly:

- **Reposition brand as "AI-native competitive intelligence"** — beat Klue/Crayon to the narrative.
- **Publish "2026 State of SaaS Pricing" report** (use your own data from 500+ tracked sites). Free, viral, lead-gen.
- **Speak at MicroConf, SaaStr, IndieHackers** (virtual first, then IRL).
- **Open-source a small piece** — e.g. your `pricingDiff.ts` engine as `pricing-diff` on GitHub. Builds credibility + SEO + inbound.
- **Build the "AI search" category** before Crayon does. Blog, talk, content. Be the founder people quote.
- **Niche down**: "competitive intelligence for bootstrapped SaaS under $5M ARR". Crayon can't go there — too small. Klue won't. You own the niche.

---

## 12-Week Master Timeline

| Week | Focus | Score to hit |
|---|---|---|
| 1 | Kill 19 projects, fix 3 bugs, switch to Stripe, add trial | Pricing 7, Code 8 |
| 2 | Annual billing, New tiers, Onboarding rewrite | Pricing 9 |
| 3 | Cold DM 50 founders, 5 demos | Distribution 3 |
| 4 | 10 paying customers, Product Hunt prep | Distribution 4, Pricing 10 |
| 5-6 | Dashboard refactor (RSC + TanStack Query) | UI/UX 8, Performance 8 |
| 7 | DB indexes, Redis caching, edge caching | Performance 9, Code 9 |
| 8 | Security sprint (CSP, 2FA, Zod, audit log) | Security 9 |
| 9 | Public Report Generator + 30 SEO pages | Distribution 7 |
| 10 | AI Visibility Monitor MVP | Product 10, Market 10 |
| 11 | Slack app + public API + Zapier | Product 10, Distribution 8 |
| 12 | SOC 2 prep, 50 customers, $4K MRR | Security 10, Distribution 9, Founder 7 |

**End state:**
- 50 paying customers
- $4K MRR growing 20% MoM
- 9.5+ on every dimension except Founder (which depends on you not starting project #21)
- Ready for YC application or 100x.VC

---

## The one thing that makes everything else easier

**Get 5 paying customers in the next 30 days.** Not features, not SEO, not a launch. Five people paying you $79/month.

Once you have $395 MRR and 5 customer relationships, every other decision (pricing, SOC 2, hiring, fundraising) gets 10x clearer. Until you do, you're guessing.

Ship nothing else until you have 5 customers. Use what you have. DM 10 people today.
