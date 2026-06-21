# RivalEye — Principal/Staff Engineer Review & Launch Tasks

**Reviewer verdict:** ✅ **PURSUE** (conditional GO — ship the P0 security fixes first).
**Date:** 2026-06-15
**Scope reviewed:** 36k LOC TS/TSX, 27 API routes, 557 tests / 49 files, diff+scoring engine, AEO scan, billing, crawler, auth.

---

## 0. Verdict in one paragraph

The engineering is genuinely strong for a solo/early product: typed end-to-end (Zod at the edges), 3-scraper fallback crawler, structured logging + Sentry, SSRF guard, CSRF origin checks, quota guardrails, a real test suite. The problem is real and the *timing* is excellent — **AEO / answer-engine visibility ("are we cited in ChatGPT/Perplexity vs competitors?") is the urgent, budget-worthy wedge** and should lead. Classic risk is vitamin-vs-painkiller: monitoring alerts are "nice to know" and churn quietly; the AI tactical brief + AEO scorecard are what turn information into a painkiller. **GO, but do not launch until the P0 items below are fixed** — there is a live unauthenticated endpoint that spends real money, and a billing-portal route whose tenant binding must be verified.

---

## Progress log (2026-06-15)

| Task | Status | Notes |
|------|--------|-------|
| SEC-1 | ✅ Done | `test/full-cycle` now 404s in prod; requires auth + CSRF + rate limit + ownership in dev. |
| SEC-2 | ✅ Done | `customer-portal` resolves `dodo_customer_id` from session and overrides client input — billing IDOR closed. |
| BIZ-1 | ✅ Done | `PLAN_PRICING` is the single source of truth ($49 Pro); dead `products.ts` placeholder ($9.99/$199.99) replaced; stale `unit_economics.md` corrected. |
| CALC-1 | ✅ Done | Magnitude-aware price severity + test (300% ranks above 6%). |
| CALC-2 | ✅ Done | `minSeverity` kept as documented backstop (functional, tested). |
| CALC-3 | ✅ Done | Unused `minPriceChangePercent` removed; magnitude lives in `pricingDiff`. |
| CALC-4 | ✅ Done | Priority widened to 0–100 so boosts no longer collapse; distinctness test added. |
| PERF-3 | ✅ Done | AEO scan: query cap + bounded concurrency + per-scan cost ceiling. |
| SEC-4 / PERF-1 | ✅ Code done | `public_slug` migration (`supabase/migrations/20260615_public_slug.sql`) + indexed lookup replaces 500-row scan. **Run the migration in Supabase.** Privacy default left at `public_listed = true` (product decision). |
| SEC-3 | ✅ Guard done | RLS already enabled in schema; added CI tenant-scoping guard test (catches future unscoped routes, which RLS can't because routes use the service role). |
| SEC-5 | ✅ Done | Upstash Redis sliding-window limiter (`@upstash/redis`) with in-memory fallback + fail-open on Redis errors. Set `UPSTASH_REDIS_REST_URL`/`_TOKEN` in prod. |
| UX-1 | ✅ Done | `CompetitorCard` shows a "Running first scan…" state for never-checked active rows instead of a bare "Never". |
| UX-2 | ✅ Already present | Onboarding step 2 already offers one-click Stripe/Notion/Linear/Figma chips. |
| UX-3 | ✅ Done | `brief_viewed` + `first_brief_viewed` analytics events fired from `CompetitiveResponseBrief` (activation milestone). |
| PERF-2 | ✅ Done (code) | Lenis smooth-scroll gated behind `prefers-reduced-motion`; ticker-removal leak fixed; `canvas-confetti` now dynamically imported + reduced-motion aware. **Lighthouse run still pending** (needs deployed/served app). |

Verification after all of the above: **586 tests pass** (was 557), production typecheck clean, `npm run build` succeeds (exit 0).

### Still requires the operator (not code)
- Apply `supabase/migrations/20260615_public_slug.sql` in Supabase.
- Provision Upstash Redis and set the two env vars (else rate limiting stays in-memory).
- Set `DODO_PRO_PRODUCT_ID`.
- Run a Lighthouse mobile audit on a served build to close PERF-2's ≥90 acceptance bar.
- Decide the `public_listed` privacy default (currently public-by-default).

---

## 1. Scoring & calculation logic — audit findings

These are correctness/logic issues found in the alerting math. None are catastrophic, but several make tuning knobs that *look* active actually dead.

| ID | File | Finding | Severity |
|----|------|---------|----------|
| CALC-1 | `src/lib/diff/pricingDiff.ts:41-51` | Price-change severity is a **static weight** (`price_increase = 0.9`) regardless of magnitude. A +6% bump and a +300% hike produce identical severity/priority. Magnitude (`percentChange`) is computed but only used in the description string. | High |
| CALC-2 | `src/lib/diff/alertRules.ts:35` | `minSeverity = 0.5` gate is effectively **dead code**: every type in `ALERTABLE_DIFF_TYPES` already has weight ≥ 0.7, so the gate never filters. Gives a false sense of tunability. | Medium |
| CALC-3 | `src/lib/diff/alertRules.ts:36` | `minPriceChangePercent = 5` in `DEFAULT_THRESHOLDS` is **never read** in `shouldTriggerAlert`; the real 5% check lives in `pricingDiff.checkPriceChanges`. Unused config. | Medium |
| CALC-4 | `src/lib/diff/alertRules.ts:149-162` | `calculatePriority` clips at 10, so `free_tier_removed` (1.0→10+2) and `price_increase` (0.9→9+1) both collapse to 10 — boosts are lost at the top. Ranking between top events is non-discriminating. | Low |
| CALC-5 | `src/lib/aeo/scan.ts:190-193` | `visibility_pct` denominator is `rows.length` (successful responses), not attempted `tasks.length`. Defensible (don't penalize API errors) but means visibility silently shifts when providers fail. Document the choice. | Low |
| CALC-6 | `src/lib/diff/isMeaningful.ts:144-150` | `> 100 char` catch-all flags any large text change as "meaningful" before keyword matching. Acceptable as a pre-AI net, but expect noise on content-heavy pages. | Low |

**Acceptance criteria for the scoring rework (CALC-1..4):**
- [ ] Price severity becomes a function of magnitude, e.g. `severity = clamp(base + f(percentChange))`, with a unit test asserting a 300% change ranks strictly above a 6% change.
- [ ] Either wire `minSeverity`/`minPriceChangePercent` into `shouldTriggerAlert` and add tests proving they filter, **or** delete them and document that magnitude lives in `pricingDiff`.
- [ ] Priority no longer saturates: top-3 distinct event types produce 3 distinct priorities in a test.
- [ ] `npm run test:run` green; new tests cover each fixed path.

---

## 2. Security — findings (P0 = launch blocker)

| ID | File | Finding | Severity |
|----|------|---------|----------|
| SEC-1 | `src/app/api/test/full-cycle/route.ts` | **Unauthenticated, no CSRF, no rate-limit** POST that triggers `triggerManualCheck` + `deepAuditTask` for any `competitorId`. Anyone can spend your Firecrawl + AI budget at will (cost-amplification / billing-DoS). Confirmed live — no `NODE_ENV` gate. | **P0 / Critical** |
| SEC-2 | `src/app/api/customer-portal/route.ts` | Dodo `CustomerPortal()` handler with no app-layer auth. **Must verify** the `customer_id` is bound to the authenticated session and not taken from a query param — otherwise it's a billing IDOR (view invoices / cancel another tenant's sub). | **P0 / High (verify)** |
| SEC-3 | `src/lib/supabase.ts:77-107` | `createServerClient()` uses the **service-role key → RLS bypassed** on every API route. Ownership is enforced manually per-handler (`.eq("user_id", userId)`). One forgotten filter = cross-tenant IDOR. Works today, but it's a systemic foot-gun. | Medium (systemic) |
| SEC-4 | `src/app/api/public/competitor/[slug]/route.ts` | Public route returns **any** tracked competitor's pricing/analysis by hostname to anyone, and loads up to 500 rows into memory per request to do an in-memory hostname match. Privacy posture + O(n) scan. Intentional "viral wedge" but needs a `public_slug` column + explicit opt-in semantics. | Medium |
| SEC-5 | `src/lib/rateLimit.ts` | In-memory `Map` limiter is **per-instance** → on serverless/edge it resets per cold start and doesn't share state. Effectively bypassable under real traffic. Acknowledged in code comment. | Medium |

**Acceptance criteria:**
- [ ] **SEC-1:** `test/full-cycle` is deleted, or gated behind `getUserId()` + `assertSameOrigin` + rate limit **and** `NODE_ENV !== "production"`. A prod request returns 401/404. Test added.
- [ ] **SEC-2:** Confirm (with a written note + test) that the portal resolves `customer_id` from the session/DB for the logged-in user, never from untrusted input. If it doesn't, wrap it.
- [ ] **SEC-3:** RLS enabled on all tenant tables with policies, even though service role bypasses it — defense-in-depth. Add a CI grep test that fails if a new `from("competitors"|"analyses"|…)` route lacks a `user_id` predicate (or migrate hot routes to a per-request JWT client).
- [ ] **SEC-4:** Add `public_slug` column + opt-in flag; query by indexed column, not 500-row scan. Public payload reviewed to contain only intended fields.
- [ ] **SEC-5:** Swap to Upstash/Redis (or Vercel KV-equivalent) sliding window for the expensive endpoints (`analysis`, `manualCheck`, `aeo`).

---

## 3. Performance

- [ ] **PERF-1** `public/competitor/[slug]`: replace `.limit(500)` + in-memory `find` with an indexed `public_slug` lookup. (Folds into SEC-4.)
- [ ] **PERF-2** Landing page (`src/app/page.tsx`, 521 LOC) loads GSAP + Lenis (smooth-scroll) + canvas-confetti. Lenis scroll-hijacking is the most common "jarring" motion anti-pattern and hurts INP. **Gate all motion behind `prefers-reduced-motion`, lazy-load confetti, and verify Lighthouse mobile LCP < 2.5s / INP < 200ms.** Acceptance: Lighthouse mobile performance ≥ 90.
- [ ] **PERF-3** AEO scan fans out `queries × 5 models` via `Promise.allSettled`. Add a concurrency cap and a per-scan cost ceiling so a custom 20-query set × 5 models can't silently 100× spend.

---

## 4. UX / friction (get to value in fewer steps)

Current first-run is solid: landing promises "Setup in 30 seconds, no credit card," 3-step onboarding (Welcome → Add competitor → Confirm). Improvements:

- [ ] **UX-1 Time-to-first-signal:** First crawl is fire-and-forget; the user lands on an empty dashboard. Show an **optimistic "we're scanning <name> now"** state with a skeleton + ETA, and push the first result via the existing realtime channel — don't make them refresh.
- [ ] **UX-2 Lead with a pre-filled example:** On step 2, offer 3 one-click sample competitors (e.g. Stripe, Notion, Linear) so a user reaches "first alert" without typing a URL. Reduces blank-page abandonment.
- [ ] **UX-3 Activation = first *meaningful* brief, not first crawl.** Instrument and optimize for "user saw their first AI tactical brief," which is the actual aha.
- [ ] **UX-4 Pricing clarity:** reconcile the price (see BIZ-1) and put the AEO scorecard above the fold — it's the differentiator.

---

## 5. Business / GTM (multi-hat)

- **CEO:** Real problem, good timing. Win condition is becoming the **AEO visibility** default for SMB before incumbents (Crayon/Klue) move down-market. Lead the narrative with "see yourself in AI answers," not "monitor competitor pages."
- **CFO / BIZ-1:** **Pricing is inconsistent across the repo** — `README.md` + landing = **Pro $49/mo**; `docs/unit_economics.md` = **Pro $19**, "Power $49 later." Pick one and propagate. At $49 with ~$0.50–$3/M token AI + Firecrawl Hobby ($19) + Trigger ($30), gross margin is healthy *because* costs scale sub-linearly (early-exit hashing, meaningful-diff gate, AI only on real changes). Acceptance: a single source of truth for price, referenced by `featureFlags`.
- **CFO / scaling wall:** `unit_economics.md` correctly flags the **Gemini free-tier ~1,000 req/day project ceiling** as the free-tier sustainability cap. Need frequency-decay on low-volatility pages + a free-tier waitlist before that bites.
- **CMO:** The public `/track/[slug]` pages are a genuine SEO/viral wedge (already have programmatic `/for/[industry]`, `/vs/[competitor]`). Tie a "Check your AI visibility free" tool to capture intent.
- **CTO:** Codebase is launch-grade *after* P0s. Biggest debt is the service-role-everywhere pattern (SEC-3) and per-instance rate limiting (SEC-5).
- **AI PM:** AEO is the moat. Ship a weekly "your AI-visibility score vs N competitors" email — that's the recurring painkiller that fights churn.

---

## 6. Suggested execution order

1. **P0 security (SEC-1, SEC-2)** — blocks launch. ~½ day.
2. **BIZ-1 price reconciliation** — trivial, unblocks marketing. ~1 hr.
3. **Scoring rework (CALC-1..4)** — correctness + tests. ~1 day.
4. **SEC-5 distributed rate limit + PERF-3 cost ceiling** — protects spend at scale. ~1 day.
5. **SEC-4/PERF-1 public_slug** — privacy + perf. ~½ day.
6. **UX-1..3 activation** — conversion. ~2 days.
7. **PERF-2 motion/Lighthouse** — polish. ~½ day.
8. **SEC-3 RLS + CI guard** — defense-in-depth. ~1 day.

**Definition of done for "launch ready":** P0s closed, pricing single-sourced, `npm run verify` green, Lighthouse mobile ≥ 90, and a test proving cross-tenant access is blocked on every tenant route.
