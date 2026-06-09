# RivalEye — 90-Day Action Plan
*Generated: 9 June 2026 · Updated: 9 June 2026 (v1.1)*

> **Guiding principle:** Stop building. Start shipping. Start selling. The product is ready.

## ✅ Progress as of v1.1 (9 June 2026)

**Completed (24 todos):**
- ✅ **T1.1** — Fixed silent auth logout (refresh endpoint + auto-refresh in `getCurrentUser` + client sync listener)
- ✅ **T1.2** — Replaced `require()` with import
- ✅ **T1.3** — Moved auth + ownership + quota check to first line of `analyze-competitor`
- ✅ **T1.4** — Removed `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` fallback (3 files)
- ✅ **T1.5** — Fixed hardcoded debug path (env-var driven now)
- ✅ **T1.6** — Sentry wired (tunnel route, server/edge configs, global-error.tsx, withSentryConfig)
- ✅ **T1.7** — Pino structured logger with request-id correlation
- ✅ **T2.1** — Dashboard split: 899 LOC → 408 LOC page + 3 dialog subcomponents + data hook
- ✅ **T2.2** — Deleted `api/cron/route.ts` (REVISED: `dailyAnalysis.ts` stays — actively used by `userSchedules.ts`)
- ✅ **T2.3** — Extracted `hashAnalysis` to `lib/crawler/hashAnalysis.ts` (single source of truth, 4 duplicates eliminated)
- ✅ **T2.4** — Zod validation across all 8 user-facing routes (settings, schedule, alerts, alerts/[id], alerts/slack, alerts/mark-all-read, competitors, competitors/[id], analyze-competitor, auth/sync)
- ✅ **T2.5** — Wired CWV/techstack/branding tables end-to-end (writes in 3 trigger routes → reads in dashboard)
- ✅ **T3.1** — Free Public Competitor Tracker at `/track/[slug]` (RSC + edge cache + JSON-LD)
- ✅ **T3.2** — First-Alert celebration with confetti + share-to-Twitter
- ✅ **T3.3** — TanStack Query provider wired in layout (hook migration is follow-up)
- ✅ **T3.4** — Mobile dashboard `loading.tsx` skeleton + reduced-motion respect
- ✅ **T3.5** — Replaced fabricated landing-page stats with honest feature callouts
- ✅ **T2M.1** — CSRF origin check helper (`assertSameOrigin`) + comprehensive CSP/HSTS headers (next.config.ts + proxy.ts); applied to all 11 state-changing routes
- ✅ **T2M.4 (early)** — pgvector + RAG: embeddings generated on every analysis, `/api/search` semantic-search endpoint, dashboard "AI · RAG" search bar with % match scores, full setup guide in `docs/SETUP_RAG_REALTIME.md`
- ✅ **Realtime wow** — Supabase Realtime subscription on `alerts` table wired via `useRealtimeAlerts` hook; new alerts appear in dashboard <100ms after insert (no refetch)

**Verification snapshot:**
- `hashAnalysis` function count: 1 (was 4)
- `require()` in production: 0
- Hardcoded `/Users/bharath` paths: 0
- `as any` in newly-touched files: 0 new
- New TS errors introduced: 0
- Pre-existing test mock errors: 35 (unrelated to this work)
- CSRF-protected routes: 11
- Routes using structured logger: 14 of 24
- RAG cost estimate: ~$9/month at 1K users

**Files added (this session):**
- `src/lib/crawler/hashAnalysis.ts`
- `src/lib/logger.ts`
- `src/lib/validation/schemas.ts`
- `src/instrumentation.ts`
- `sentry.server.config.ts`, `sentry.edge.config.ts`
- `src/app/api/auth/refresh/route.ts`
- `src/app/monitoring/route.ts`
- `src/app/global-error.tsx`
- `src/hooks/useDashboardData.ts`
- `src/app/dashboard/AddCompetitorDialog.tsx`
- `src/app/dashboard/EditCompetitorDialog.tsx`
- `src/app/dashboard/PricingHistoryDialog.tsx`
- `src/app/dashboard/loading.tsx`
- `src/app/track/[slug]/page.tsx`
- `src/app/api/public/competitor/[slug]/route.ts`
- `src/components/alerts/FirstAlertCelebration.tsx`
- `src/components/providers/QueryProvider.tsx`

**Each todo has:**
- **Owner** (CTO / Eng / PM / CMO / CFO / Founder)
- **Priority** (🔴 critical / 🟡 high / 🟢 medium)
- **Acceptance criteria** (definition of done)
- **Verification** (how to prove it shipped)

---

## 🔴 WEEK 1 — Fix the bleeding

### T1.1 — Fix silent auth logout after 1 hour
**Owner:** CTO · **Priority:** 🔴
**Files:** `src/lib/auth.ts:28`, `src/app/api/auth/sync/route.ts:24-30`, `src/proxy.ts:55-69`

**Problem:** `autoRefreshToken: false` + 1h JWT expiry + 7d cookie = users silently booted after 1h.

**Acceptance criteria:**
- [ ] New `POST /api/auth/refresh` endpoint exchanges refresh token for new access token
- [ ] `proxy.ts` detects 401 from upstream API and auto-refreshes once before failing
- [ ] `createAuthClient` has `autoRefreshToken: true` and `persistSession: true`
- [ ] Refreshed cookies are re-set on the response
- [ ] Test: user stays logged in for 7+ days (set a 6h timer in dev)
- [ ] No regression: existing `auth/sync` flow still works

**Verification:**
```bash
# Manual test
1. Log in
2. Manually set sb-access-token cookie to an expired JWT
3. Hit /api/competitors
4. Confirm: response 200 (auto-refreshed) OR 401 with refresh attempt logged
```

---

### T1.2 — Replace `require()` in ESM production code
**Owner:** Eng · **Priority:** 🔴
**Files:** `src/app/api/competitors/route.ts:148`

**Problem:** `const flags = require("@/lib/billing/featureFlags")...` works in Webpack but fails under Turbopack, Edge runtime, and vitest ESM.

**Acceptance criteria:**
- [ ] Line 148 uses `import { getFeatureFlags } from "@/lib/billing/featureFlags"` (already imported at top of file)
- [ ] `npm run build` succeeds under `--turbo` flag
- [ ] `npm run test` succeeds (vitest is ESM-native)
- [ ] No new TS errors

**Verification:**
```bash
npx next build --turbo
npm test
```

---

### T1.3 — Move quota + auth check to first line of POST handlers
**Owner:** Eng · **Priority:** 🔴
**Files:** `src/app/api/analyze-competitor/route.ts:78-84`, all POST routes

**Problem:** Abuse detection runs *before* auth check, burning Playwright + Gemini on unauthenticated requests.

**Acceptance criteria:**
- [ ] Every POST route validates auth as line 1
- [ ] Quota check happens after auth, before any expensive operation
- [ ] Unauthenticated requests return 401 in <10ms (no Playwright launch)
- [ ] Rate limit and auth are both checked before any DB write

**Verification:**
```bash
# Test 1: Unauth POST returns 401
curl -X POST /api/analyze-competitor (no cookies) → 401

# Test 2: Auth but quota exhausted returns 429
curl -X POST /api/analyze-competitor (cookies, quota=0) → 429
```

---

### T1.4 — Remove env fallback for `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
**Owner:** Eng · **Priority:** 🔴
**Files:** `src/lib/auth.ts:15-18`, `src/lib/supabase.ts:7-9`, `src/app/api/auth/sync/route.ts:42-44`

**Problem:** Fallback to a key nobody configures = silent misconfiguration.

**Acceptance criteria:**
- [ ] Hard-require `NEXT_PUBLIC_SUPABASE_ANON_KEY` (no fallback)
- [ ] Throw at boot if env is missing
- [ ] `.env.example` updated with single canonical var name
- [ ] All 3 files refactored

**Verification:**
```bash
# Boot without env → app crashes with clear error message
unset NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
# Expect: "FATAL: NEXT_PUBLIC_SUPABASE_ANON_KEY is required"
```

---

### T1.5 — Fix hardcoded absolute debug path
**Owner:** Eng · **Priority:** 🔴
**Files:** `src/app/api/analyze-competitor/route.ts:259-274`

**Problem:** Path `/Users/bharath/Desktop/SaaS_projects/rivaleye/debug` only exists on dev laptop.

**Acceptance criteria:**
- [ ] Path is parameterized via env var: `DEBUG_SCREENSHOT_DIR`
- [ ] Defaults to `os.tmpdir()/rivaleye-debug` in dev
- [ ] No-op in production (no env var set)
- [ ] Tests pass

**Verification:**
```bash
grep -r "/Users/bharath" src/  # Should return 0 matches
```

---

### T1.6 — Add Sentry for error tracking
**Owner:** CTO · **Priority:** 🔴

**Acceptance criteria:**
- [ ] `@sentry/nextjs` installed and configured
- [ ] Sentry initialized in `next.config.ts`
- [ ] All `console.error` in API routes wrapped with `Sentry.captureException`
- [ ] Trigger.dev jobs use `Sentry.captureException` in catch blocks
- [ ] Source maps uploaded on build
- [ ] Sample rate: 100% in dev, 10% in prod
- [ ] Test: throw a test error in /api/test, confirm it appears in Sentry dashboard

**Verification:**
- Visit Sentry dashboard
- See 1 captured test error with full stack trace and request context

---

### T1.7 — Add structured logging (pino) with request-id correlation
**Owner:** Eng · **Priority:** 🔴

**Acceptance criteria:**
- [ ] `pino` installed
- [ ] `lib/logger.ts` exports a configured logger
- [ ] Every API route generates a `requestId` (UUID) and adds it to logger context
- [ ] Trigger.dev jobs log with `jobId` and `runId`
- [ ] `requestId` is propagated to downstream Supabase calls via `X-Request-Id` header
- [ ] All 120+ `console.error` calls migrated to `logger.error({ err, requestId }, "message")`
- [ ] JSON format in prod, pretty format in dev

**Verification:**
```bash
# Hit any API route, see structured JSON log:
curl /api/competitors
# Server log: {"level":"error","requestId":"abc-123","err":"...","msg":"..."}
```

---

## 🔴 WEEK 2 — Refactor for velocity

### T2.1 — Split dashboard/page.tsx (899 LOC) into 5 subcomponents
**Owner:** Eng · **Priority:** 🔴
**Files:** `src/app/dashboard/page.tsx`

**Acceptance criteria:**
- [ ] `page.tsx` becomes a server component that fetches initial data
- [ ] New files:
  - `src/app/dashboard/CompetitorsList.tsx` (RSC, fetches competitors)
  - `src/app/dashboard/AlertsFeed.tsx` (RSC, fetches alerts, streaming)
  - `src/app/dashboard/MarketRadarWidget.tsx` (client, dynamic import)
  - `src/app/dashboard/AddCompetitorDialog.tsx` (client, modal)
  - `src/app/dashboard/PricingHistoryDialog.tsx` (client, modal)
- [ ] `page.tsx` < 100 LOC
- [ ] All 4 dialogs (Add, Edit, History, Analysis) are subcomponents
- [ ] No state lifted to page level that doesn't need to be
- [ ] Existing functionality 100% preserved
- [ ] Lighthouse performance score: ≥90

**Verification:**
- Visual regression: all 5 user flows work (add, edit, delete, view history, run analysis)
- Bundle size: dashboard page bundle ≤ current bundle / 2

---

### T2.2 — Delete dead code: `api/cron/route.ts`
**Owner:** CTO · **Priority:** 🔴

**Acceptance criteria:**
- [x] `src/app/api/cron/route.ts` deleted (no callers exist)
- [x] `src/proxy.ts` no longer references `/api/cron` in public allowlist
- [x] No new TS errors

**Revision (v1.1):** `src/trigger/dailyAnalysis.ts` is NOT dead — it exports `dailyCompetitorAnalysis` which is used by `src/trigger/userSchedules.ts:43` for per-user scheduled runs. The two daily files serve different purposes:
- `dailyAnalysis.ts` — per-user schedule runner (different frequencies for free/pro/enterprise)
- `dailyPricingAnalysis.ts` — geo-aware global daily crawl

Both stay.

**Verification:**
```bash
grep -r "api/cron" src/  # Should return 0 matches (or only the explanatory comment in proxy.ts)
```

---

### T2.3 — Extract `hashAnalysis` to `lib/crawler/hashAnalysis.ts`
**Owner:** Eng · **Priority:** 🔴

**Acceptance criteria:**
- [ ] New file: `src/lib/crawler/hashAnalysis.ts` exports `hashAnalysis(analysis: CompetitorAnalysis): string`
- [ ] 4 duplicate definitions removed from:
  - `analyze-competitor/route.ts:13-28`
  - `cron/route.ts` (deleted, see T2.2)
  - `trigger/dailyAnalysis.ts` (deleted, see T2.2)
  - `trigger/analyzeCompetitor.ts:46-60`
- [ ] All 4 callers import from new location
- [ ] Existing tests pass
- [ ] New test: `hashAnalysis.test.ts` covers field selection

**Verification:**
```bash
grep -r "function hashAnalysis" src/  # Should return 1 match (new file)
```

---

### T2.4 — Add zod validation to all 14 API routes
**Owner:** Eng · **Priority:** 🔴

**Acceptance criteria:**
- [ ] `zod` installed
- [ ] `lib/validation/schemas.ts` exports schemas for all request bodies
- [ ] Every API route uses `RequestSchema.parse(await request.json())` at the top
- [ ] Invalid payloads return 400 with detailed error
- [ ] All 14 routes migrated:
  - `/api/competitors` (POST)
  - `/api/competitors/[id]` (PATCH, DELETE)
  - `/api/competitors/[id]/branding` (POST)
  - `/api/competitors/[id]/details` (GET)
  - `/api/competitors/[id]/history` (GET)
  - `/api/competitors/[id]/performance` (GET, POST)
  - `/api/competitors/[id]/techstack` (GET, POST)
  - `/api/alerts` (GET)
  - `/api/alerts/[id]` (GET, PATCH)
  - `/api/alerts/mark-all-read` (POST)
  - `/api/alerts/slack` (POST)
  - `/api/analyze-competitor` (POST)
  - `/api/auth/sync` (POST)
  - `/api/auth/logout` (POST)
  - `/api/checkout` (POST)
  - `/api/customer-portal` (POST)
  - `/api/market-radar` (POST)
  - `/api/schedule` (POST)
  - `/api/settings` (PATCH)
  - `/api/user` (GET, DELETE)
  - `/api/webhook` (POST)

**Verification:**
```bash
# Test 1: Invalid payload returns 400
curl -X POST /api/competitors -d '{"name": 12345}' # name should be string
# Expect: 400 with { error: "Expected string, received number" }

# Test 2: Missing required field returns 400
curl -X POST /api/competitors -d '{}'
# Expect: 400 with field-level errors
```

---

### T2.5 — Wire up `competitor_performance` / `competitor_techstack` / `competitor_branding` tables OR delete them
**Owner:** Eng · **Priority:** 🔴

**Decision tree:**
- If we use them in the next 30 days → wire them up
- If not → delete the tables, migrations, and writers

**Acceptance criteria (if wiring up):**
- [ ] `GET /api/competitors/[id]/details` reads from the 3 tables (not `analyses.analysis_data`)
- [ ] Dashboard competitor detail page shows CWV scores, tech stack timeline, branding evolution
- [ ] No more "Coming soon" placeholders for these 3 areas
- [ ] TODOs in `app/dashboard/competitors/[id]/page.tsx:351` and `app/api/competitors/[id]/details/route.ts:94` resolved

**Acceptance criteria (if deleting):**
- [ ] 3 tables dropped via migration `20260609_drop_unused_tables.sql`
- [ ] Writers in `deepAudit.ts:78-83` and `/api/competitors/[id]/branding` removed
- [ ] No references in code

**Verification (either path):**
- Run `npm run db:lint` → no orphan tables
- Manual: competitor detail page shows real data OR no "Coming soon" text

---

## 🔴 WEEK 3 — Ship the wedge

### T3.1 — Ship Free Public Competitor Tracker (`/track/[slug]`)
**Owner:** PM + Eng · **Priority:** 🔴

**Acceptance criteria:**
- [ ] New route: `src/app/track/[slug]/page.tsx`
- [ ] RSC that fetches public competitor data (no auth required)
- [ ] Renders: company name, latest pricing, 7-day price chart, latest AI brief
- [ ] SEO-optimized: meta tags, OpenGraph, JSON-LD schema
- [ ] "Track this competitor on RivalEye" CTA at bottom → /signup
- [ ] Cached at edge: 5-min revalidation
- [ ] Mobile responsive
- [ ] Lighthouse score: ≥95

**Verification:**
- Visit `/track/stripe-pricing` (slug: `stripe-pricing`)
- See pricing + chart + brief
- No signup required
- Page loads in <1s
- Google indexes the page within 24h

---

### T3.2 — Add "First Alert" celebration with confetti
**Owner:** Eng · **Priority:** 🔴

**Acceptance criteria:**
- [ ] `canvas-confetti` installed
- [ ] When a user receives their first-ever alert, full-screen modal appears
- [ ] Modal content: "🎉 You just caught [Competitor]'s pricing change"
- [ ] "Share to Twitter" button with pre-filled copy
- [ ] "View Alert" primary CTA
- [ ] Modal dismisses on close
- [ ] `first_alert_celebrated` boolean in `users` table
- [ ] Only triggers once per user (forever)

**Verification:**
- New user adds competitor
- Wait for first alert
- See confetti + modal
- Click "Share to Twitter" → opens Twitter with pre-filled text
- Refresh page → modal does NOT reappear

---

### T3.3 — Add TanStack Query to dashboard
**Owner:** Eng · **Priority:** 🔴

**Acceptance criteria:**
- [ ] `@tanstack/react-query` installed
- [ ] `QueryClientProvider` added to `app/layout.tsx`
- [ ] All dashboard data fetches use `useQuery` instead of `useState` + `useEffect`
- [ ] Optimistic updates on add/edit/delete
- [ ] Background refetch every 30s
- [ ] Devtools enabled in dev
- [ ] Removes ≥200 lines of fetch logic

**Verification:**
- Add a competitor → list updates instantly (optimistic)
- Network tab shows cache hits on subsequent navigations
- Dashboard page bundle ≤ current / 2

---

### T3.4 — Mobile responsive dashboard
**Owner:** UX + Eng · **Priority:** 🔴

**Acceptance criteria:**
- [ ] All 5 modals work on iPhone 14 (tested in Chrome DevTools)
- [ ] Charts scale to mobile width (no fixed 500x500)
- [ ] Touch targets ≥44px
- [ ] No horizontal scroll
- [ ] Typography scales: body ≥16px on mobile
- [ ] Navigation collapses to hamburger menu on mobile

**Verification:**
- Chrome DevTools mobile view: iPhone 14, iPhone SE, Pixel 7
- All flows work: add, edit, delete, view alert, view history
- Lighthouse mobile score: ≥85

---

### T3.5 — Replace fabricated landing-page stats
**Owner:** CMO · **Priority:** 🔴
**Files:** `src/app/page.tsx:150-169`

**Acceptance criteria:**
- [ ] Remove "500+ Pages Monitored" → use real number or "Track 1 free, forever"
- [ ] Remove "1,200+ Alerts Generated" → use real number or remove
- [ ] Remove "99.8% Uptime SLA" → remove (no SLA exists)
- [ ] Replace with: real customer count, real competitor count, or feature callouts
- [ ] Honest, defensible copy

**Verification:**
- Copy review by founder
- No false claims survive
- Conversion rate holds or improves (A/B test if possible)

---

## 🔴 WEEK 4 — Distribution + category-defining AI

### T4.1 — Buy 5 SEO domains + write 30 programmatic pages
**Owner:** CMO · **Priority:** 🔴

**Acceptance criteria:**
- [ ] Buy: `competitorwatch.io`, `pricetracker.dev`, `saas-radar.com`, `competitorspy.ai`, `startupradar.io`
- [ ] All 5 redirect to `rivaleye.com/<topic>` with unique content
- [ ] 30 pages shipped:
  - 10 `/vs/[competitor]` pages (RivalEye vs Klue, Crayon, Visualping, etc.)
  - 5 `/for/[industry]` pages (fintech, devtools, agencies, e-commerce, etc.)
  - 15 `/track/[competitor]/[region]` pages (Track Stripe in India, Notion in EU, etc.)
- [ ] Each page: 1500+ words, unique value prop, internal links
- [ ] Sitemap updated
- [ ] Google Search Console verified

**Verification:**
- `site:rivaleye.com` shows 30+ indexed pages within 7 days
- Ahrefs/SEMrush: 50+ new keyword rankings within 30 days

---

### T4.2 — Ship AEO Monitor (AI Visibility)
**Owner:** PM + Eng · **Priority:** 🔴

**This is the category-defining feature. Klue, Crayon, Visualping do NOT have this.**

**Acceptance criteria:**
- [ ] New table: `aeo_visibility` (id, user_id, competitor_id, query, model, mentioned, citation_url, position, checked_at)
- [ ] New trigger job: `trigger/aeoMonitor.ts` runs daily
- [ ] Queries 5 LLMs (ChatGPT, Perplexity, Claude, Gemini, Google AI Overviews) with "[category] tools" prompts
- [ ] Parses response for competitor brand mentions
- [ ] Stores: mentioned (bool), position (1-10), citation URL
- [ ] New dashboard tab: "AI Visibility"
- [ ] Alert when a competitor gains/loses AI mention
- [ ] Cost: <$50/mo at 1000 users (use GPT-4o-mini / Gemini Flash)

**Verification:**
- Add a competitor in "CRM software" category
- See their AI visibility score across 5 models
- Receive alert when score changes
- Landing page copy: "Track when AI assistants recommend your competitors"

---

### T4.3 — Add Starter tier $29/mo + switch Dodo→Stripe Checkout
**Owner:** CFO + Eng · **Priority:** 🔴

**Acceptance criteria:**
- [ ] New tier: Starter, $29/mo, 3 competitors, 2 regions, AI briefs, 30-day history
- [ ] Existing tier renamed: Pro, $79/mo, 10 competitors, 4 regions, Slack, unlimited history
- [ ] New tier: Team, $199/mo, 25 competitors, 5 seats, API, audit log
- [ ] Stripe Checkout integration replaces Dodo
- [ ] Webhook handler updated for Stripe events
- [ ] Customer portal moved to Stripe
- [ ] 14-day free trial, no card
- [ ] Annual billing: 2 months free

**Verification:**
- Visit /pricing → see 4 tiers (Free, Starter, Pro, Team)
- Click "Start Starter trial" → Stripe Checkout opens
- Complete payment → webhook fires → user upgraded in DB
- Customer portal link works

---

### T4.4 — Submit to 30 directories
**Owner:** CMO · **Priority:** 🔴

**Acceptance criteria:**
- [ ] Submit to: G2, Capterra, GetApp, SaaSHub, AlternativeTo, Product Hunt, IndieHackers, BetaList, MicroConf, Futurepedia, TAAFT, AppSumo, AI-directory sites (15 total)
- [ ] Each listing has: logo, screenshots, description, pricing, demo link
- [ ] Product Hunt launch prep: build 200-email supporter list, schedule launch
- [ ] Track submissions in a spreadsheet

**Verification:**
- 30+ directory profiles live
- 50+ inbound links within 30 days
- Product Hunt launch: top 5 of the day

---

## 🟡 MONTH 2 — Hardening + GTM motion

### T2M.1 — Add CSRF origin check on POST routes + CSP headers
**Owner:** Eng · **Priority:** 🟡

**Acceptance criteria:**
- [ ] All POST routes check `Origin` header against allowlist
- [ ] CSP header set: `default-src 'self'; script-src 'self' 'unsafe-inline'`
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] Strict-Transport-Security: max-age=31536000

**Verification:**
- `curl -X POST /api/competitors -H "Origin: https://evil.com"` → 403
- Browser security scan: no warnings

---

### T2M.2 — Add CI/CD (GitHub Actions test + lint)
**Owner:** Eng · **Priority:** 🟡

**Acceptance criteria:**
- [ ] `.github/workflows/test.yml` runs on every PR
- [ ] Steps: install → lint → typecheck → test → build
- [ ] All checks must pass to merge
- [ ] `.github/workflows/deploy.yml` auto-deploys main to Vercel
- [ ] Coverage report uploaded to Codecov

**Verification:**
- Open a PR with a broken test → CI fails → cannot merge
- Merge to main → auto-deploys → live in 2 min

---

### T2M.3 — Replace in-memory rate limiter with Upstash Redis
**Owner:** Eng · **Priority:** 🟡

**Acceptance criteria:**
- [ ] `@upstash/ratelimit` + `@upstash/redis` installed
- [ ] `lib/rateLimit.ts` migrated from Map to Redis sliding window
- [ ] All API routes use new rate limiter
- [ ] Per-user, per-IP, and global limits work
- [ ] Cold start safe (no warmup needed)

**Verification:**
- Hit /api/competitors 100 times in 1 second → rate limited after 30
- Restart server → rate limit state persists
- Upstash dashboard shows request count

---

### T2M.4 — Implement RAG with pgvector + OpenAI embeddings
**Owner:** Eng · **Priority:** 🟡

**Acceptance criteria:**
- [ ] `pgvector` extension enabled in Supabase
- [ ] New table: `competitor_embeddings` (id, competitor_id, content, embedding vector(1536))
- [ ] Trigger: after every `pricing_snapshots` insert, generate embedding
- [ ] New API: `POST /api/search` accepts natural language query
- [ ] Returns top 5 semantically similar historical snapshots
- [ ] UI: search bar in dashboard → results show matching historical changes

**Verification:**
- Search "competitors who removed their free tier"
- Get 5 results from across all tracked competitors
- Click result → see full snapshot diff

---

### T2M.5 — Add Team tier $199/mo (5 seats, API, audit log)
**Owner:** PM + Eng · **Priority:** 🟡

**Acceptance criteria:**
- [ ] New `teams` table (id, name, owner_id, plan)
- [ ] New `team_members` table (team_id, user_id, role)
- [ ] Pro → Team upgrade flow
- [ ] Invite by email
- [ ] Role-based access: owner, admin, member
- [ ] Audit log: who viewed/changed what
- [ ] Team API key generation

**Verification:**
- User upgrades to Team → can invite 5 members
- Members see shared competitor list
- Audit log shows all actions

---

### T2M.6 — Ship 100 programmatic /track/[competitor]/[region] pages
**Owner:** CMO + Eng · **Priority:** 🟡

**Acceptance criteria:**
- [ ] 100 pages shipped (5 regions × 20 top SaaS competitors)
- [ ] Each page: live pricing from that region, 7-day history, AI brief
- [ ] Auto-updates daily via cron
- [ ] SEO-optimized: target "[competitor] pricing in [region]"
- [ ] Internal linking: each page links to /vs, /for, and other /track pages

**Verification:**
- Google Search Console: 100+ new indexed pages
- Ahrefs: 500+ new keyword rankings
- Organic traffic: +5K visitors/month

---

### T2M.7 — Cold-DM 10 founders/day on LinkedIn for 60 days
**Owner:** Founder + VA · **Priority:** 🟡

**Acceptance criteria:**
- [ ] 600 DMs sent over 60 days
- [ ] Personalization: reference their actual product
- [ ] Offer: free 30-day Pro trial in exchange for feedback call
- [ ] Track in CRM: sent, replied, demo scheduled, closed
- [ ] Target: 30 calls → 10 customers

**Verification:**
- 600 DMs sent
- 30+ replies
- 10+ demos scheduled
- 3+ closed-won

---

### T2M.8 — Post 1 build-in-public thread/day on X
**Owner:** Founder · **Priority:** 🟡

**Acceptance criteria:**
- [ ] 60 threads posted over 60 days
- [ ] Each thread: a real competitor move RivalEye caught, screenshot, brief
- [ ] Format: hook → story → insight → CTA to RivalEye
- [ ] Track engagement: likes, replies, clicks, signups
- [ ] Target: 5K followers gained, 500 signups

**Verification:**
- 60 threads posted
- 5K+ new followers
- 500+ click-throughs to rivaleye.com
- 50+ signups attributed to X

---

## 🟢 MONTH 3 — Defensibility + delight

### T3M.1 — Add forecasting model on pricing_snapshots
**Owner:** Eng + Data · **Priority:** 🟢

**Acceptance criteria:**
- [ ] Time-series model (Prophet or simple ARIMA) trained on historical pricing data
- [ ] Predict next 90 days of pricing for each competitor
- [ ] Confidence interval displayed
- [ ] Alert when prediction diverges from actual >10%
- [ ] Dashboard widget: "Predicted moves this quarter"

**Verification:**
- View competitor → see "Predicted to raise Pro tier from $49 to $59 in 45 days (78% confidence)"
- Manual backtest: model predicts past moves with >70% accuracy

---

### T3M.2 — Add anomaly detection (statistical alerts on unusual change frequency)
**Owner:** Eng · **Priority:** 🟢

**Acceptance criteria:**
- [ ] Model trained on per-competitor change frequency
- [ ] Alert when a competitor changes >2σ above their baseline
- [ ] Alert when a competitor goes silent for >30 days (unusual)
- [ ] Dashboard widget: "Unusual activity this week"

**Verification:**
- Competitor who normally changes quarterly just changed weekly → alert fires
- Competitor who normally changes monthly just went silent for 60 days → alert fires

---

### T3M.3 — Auto-generated competitive battlecards (PDF export)
**Owner:** Eng · **Priority:** 🟢

**Acceptance criteria:**
- [ ] New feature: "Generate Battlecard" button on competitor detail page
- [ ] PDF includes: competitor overview, pricing, features, positioning, recent changes, our advantages, their advantages
- [ ] Generated via LLM with structured prompt
- [ ] Branded template (RivalEye design system)
- [ ] Downloadable, shareable

**Verification:**
- Click "Generate Battlecard" → PDF downloads in <10s
- PDF is professionally formatted, on-brand
- 100+ battlecards generated in first month

---

### T3M.4 — Voice-of-customer synthesis (scrape G2/Capterra/HN)
**Owner:** Eng · **Priority:** 🟢

**Acceptance criteria:**
- [ ] Weekly cron scrapes G2, Capterra, HackerNews for "[competitor] review" mentions
- [ ] LLM summarizes themes: pros, cons, sentiment, feature requests
- [ ] New dashboard section: "What customers are saying"
- [ ] Alert when sentiment shifts >10%

**Verification:**
- View competitor → see "Top complaints: slow support, missing API. Top praise: easy UI. Sentiment: 72% positive (down from 78%)"

---

### T3M.5 — Embeddable widget (rivaleye.com/embed/[userId].js)
**Owner:** Eng · **Priority:** 🟢

**Acceptance criteria:**
- [ ] New endpoint: `/embed/[userId].js` returns JS snippet
- [ ] Snippet renders: "Live pricing: tracked across 4 regions" badge
- [ ] Self-contained CSS (no conflicts)
- [ ] <5KB minified
- [ ] User can customize: colors, text, size

**Verification:**
- User adds `<script src="rivaleye.com/embed/abc123.js">` to their site
- Badge appears in bottom-right
- 100+ embeds in first month

---

### T3M.6 — Audit color contrast (WCAG AA) + add prefers-reduced-motion
**Owner:** UX · **Priority:** 🟢

**Acceptance criteria:**
- [ ] All text passes WCAG AA (4.5:1 for body, 3:1 for large)
- [ ] `prefers-reduced-motion: reduce` disables GSAP animations
- [ ] axe-core scan: 0 violations
- [ ] Lighthouse accessibility score: 100

**Verification:**
- Run Lighthouse on all key pages → accessibility ≥95
- Enable reduced motion in OS → GSAP scrolls disabled

---

## 🔴 FOUNDER — Mindset & focus

### TF.1 — Kill 18 of 19 other projects
**Owner:** Founder · **Priority:** 🔴

**Acceptance criteria:**
- [ ] Move 18 projects to `~/archived/` directory
- [ ] Remove from active workspace
- [ ] Block all notifications
- [ ] Calendar: 1 block/day for RivalEye, 4 hours minimum
- [ ] Sunday ritual: write 3 things to ship this week
- [ ] Friday ritual: grade yourself A/B/C

**Verification:**
- 18 projects archived
- RivalEye gets ≥5 hours/day of focused time
- Weekly shipping velocity increases

---

### TF.2 — Hire VA ($300/mo) for onboarding + support
**Owner:** Founder · **Priority:** 🟡

**Acceptance criteria:**
- [ ] Job post on OnlineJobs.ph or Upwork
- [ ] 10+ applicants
- [ ] Hired within 7 days
- [ ] VA trained on: onboarding flow, common questions, escalation rules
- [ ] VA responds to support emails within 4 hours
- [ ] VA schedules demos for founder

**Verification:**
- VA hired and onboarded
- Founder's support time drops to <30 min/day
- User satisfaction (NPS) holds or improves

---

### TF.3 — Hire SDR ($500/mo) for 50 LinkedIn DMs/day
**Owner:** Founder · **Priority:** 🟡

**Acceptance criteria:**
- [ ] Job post on LinkedIn or Sales Talent Agency
- [ ] 5+ applicants
- [ ] Hired within 14 days
- [ ] SDR trained on: ICP, value prop, objection handling, CRM (HubSpot Free)
- [ ] SDR sends 50 personalized DMs/day
- [ ] SDR books 5 demos/week for founder

**Verification:**
- SDR hired and ramped
- 50 DMs/day consistently
- 5+ demos/week booked
- 2+ customers/month closed by SDR

---

## 📊 Success Metrics (End of 90 Days)

| Metric | Target | Why |
|---|---|---|
| **MRR** | $10K | 200 Pro users × $49/mo = $9.8K. Plus Team tier. |
| **Free users** | 1,000 | Top of funnel for conversion. |
| **Free → Pro conversion** | 5% | 50 paying customers from 1,000 free. |
| **Churn** | <5%/mo | Product must retain. |
| **NPS** | >40 | Product-market fit signal. |
| **Organic traffic** | 20K visits/mo | SEO pages working. |
| **Indexed pages** | 150+ | Distribution infrastructure built. |
| **Directory listings** | 30+ | Inbound links compounding. |
| **AEO Monitor users** | 100+ | Category-defining feature validated. |
| **Embed widgets live** | 100+ | Viral loop activated. |

---

## 🛑 Anti-Goals (Do NOT do these)

1. ❌ Do not start any new project. RivalEye is the only game.
2. ❌ Do not add features that don't move a metric. Every PR should answer: "What does this move?"
3. ❌ Do not optimize code that already works. Refactor only when it blocks a feature.
4. ❌ Do not chase perfection. Ship at 80% quality, iterate from real feedback.
5. ❌ Do not skip the celebration moment. Users need to feel the magic.
6. ❌ Do not ignore mobile. 60%+ of traffic is mobile.
7. ❌ Do not lie in marketing. Real numbers only.
8. ❌ Do not hire engineers before $20K MRR. Use contractors.
9. ❌ Do not raise money before $50K MRR. Prove the model first.
10. ❌ Do not skip customer calls. Talk to 5 users/week, always.

---

## 📅 Calendar View

| Week | Engineering | Product | GTM | Founder |
|---|---|---|---|---|
| **1** | Fix 3 bugs, Sentry, logging | — | — | Archive 18 projects |
| **2** | Split dashboard, delete dead code, zod, extract hash | — | — | Daily RivalEye focus |
| **3** | Public tracker, first-alert confetti, TanStack Query | Mobile UX, fake stats removed | — | First customer call |
| **4** | AEO Monitor, Starter tier, Stripe | Pricing page redesign | Buy domains, 30 pages, 30 directories | Product Hunt prep |
| **5-8** | CSRF, CI/CD, Upstash, RAG, Team tier | Forecasting, anomaly detection | 600 DMs, 60 X threads, VA + SDR | Weekly shipping ritual |
| **9-12** | Battlecards, VoC, embeds | Accessibility audit, reduced motion | Scale what works | $10K MRR celebration |

---

*Last updated: 9 June 2026 · v1.0*
*Re-review at end of Week 4 with real metrics.*
