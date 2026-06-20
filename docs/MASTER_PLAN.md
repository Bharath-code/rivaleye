# RivalEye — Master Plan (Track 0 → 6)

> Single source of truth for the road from "archived backend + 4 months of procrastination"
> to "10 paying customers and a fundable company." Each track has a **Goal**, **Why**,
> **Tasks**, and **Acceptance Criteria** (binary, verifiable). Update Status as you go.
>
> **Last updated:** 2026-06-20 · **Status legend:** ⬜ todo · 🟦 in progress · ✅ done · 🅿️ parked

---

## North Star
Get **10 paying customers** who'd be genuinely upset if RivalEye disappeared. Everything
else (brand, funding, scale) is downstream of that. The product is **already real and
largely delivers** — the work is honesty, activation, and distribution, not a rewrite.

## Platform decision (recorded 2026-06-20): **STAY ON SUPABASE**
The app is deeply coupled to Postgres + RLS + Supabase Auth + pgvector + 6 RPC functions
across 27 routes. Moving to Convex (document/reactive, no SQL/RLS) or Cloudflare D1
(SQLite, no pgvector, needs separate auth) is a **multi-week rewrite for zero user benefit**
and *more* setup friction, not less. The real problems are (1) the free project paused→
archived from 4 months of inactivity, and (2) key-management friction. Both are solved in
Track 0 without switching. Revisit only if Supabase costs or limits actually bite post-revenue.

---

## Track 0 — UNBLOCK: recreate backend + kill setup friction  🟦 IMMEDIATE
**Goal:** A fresh, reproducible backend you can stand up in <30 min, and a local app that
runs with the *minimum* number of keys. This is the prerequisite for every other track.

**Why:** You've procrastinated 4 months because spinning this up means hunting ~10 keys and
applying fragmented SQL by hand. Fix the friction once, permanently.

**Tasks**
- T0.1 — Consolidate DB into one idempotent `supabase/bootstrap.sql` (schema + all 12
  migrations from both `./migrations/` and `./supabase/migrations/`, in order) incl. RLS,
  the 6 RPCs (`detect_aeo_changes`, `increment_crawl_count`, `increment_manual_check_count`,
  `match_competitor_embeddings`, `get_competitor_visibility`, `get_competitor_visibility_by_model`),
  `create extension vector`, and storage bucket inserts.
- T0.2 — Create new Supabase project; run `bootstrap.sql`; enable Google + GitHub OAuth +
  email magic link; create storage buckets; confirm pgvector enabled.
- T0.3 — Tier the env vars: write `docs/MINIMUM_SETUP.md` splitting keys into **REQUIRED to
  run the core loop** (Supabase URL+publishable+service-role, one AI key [OpenRouter or
  Gemini], Firecrawl, ENCRYPTION_KEY) vs **OPTIONAL/degrade-gracefully** (Turnstile, R2,
  Resend, PostHog, Trigger.dev, Dodo). Each key: 1-line "where to get it" + link.
- T0.4 — Make optional services degrade cleanly in dev (no hard throw when absent): Turnstile
  (bypass in dev), Resend (log instead of send), R2 (skip screenshot), PostHog (no-op),
  Dodo (disable checkout). Verify app + core loop run with REQUIRED keys only.
- T0.5 — Keep-warm guard: confirm a daily Trigger.dev cron (or a trivial scheduled query)
  hits Supabase so the project never idles into a pause again. Document the Supabase
  free-tier pause policy (7-day inactivity) and the Pro upgrade trigger ($25/mo once paying).
- T0.6 — Consolidate the two migration directories into one; delete `.temp`; commit.

**Acceptance Criteria**
- [ ] `supabase/bootstrap.sql` applied to a blank project produces a schema where `npm run dev`
      boots and **signup → add competitor → teardown** works end-to-end.
- [ ] `docs/MINIMUM_SETUP.md` lets a from-scratch dev run the core loop with ≤7 keys.
- [ ] App starts and core loop runs with OPTIONAL keys *absent* (no crash, clear log lines).
- [ ] A scheduled job demonstrably queries Supabase ≥ daily (anti-pause).
- [ ] One migrations directory; `npm run verify` green.

---

## Track 1 — PROVE THE PROMISE  ✅ (mostly done — PR #4)
**Goal:** A stranger gets a brief obviously worth paying for, and the site tells the truth.

**Done (PR #4 — 8 atomic commits, `verify` green):** removed fabricated social proof;
fixed 2 runtime blockers (route slug conflict, Supabase key drift); honest AEO copy;
4→regions fix; OAuth-first login; domain unified to rivaleye.app; dead code + prompt leak.
Audit verdict: product is real; all six pillars wired + tested.

**Remaining Tasks**
- T1.1 — 🟦 Live walk of the authenticated path: sign in → add competitor → **witness the
  free teardown "aha"**; time it; catch empty states/breakage; screenshot evidence.
- T1.2 — ⬜ Decide free-tier "aha" strategy: the ungated vision teardown is the free wow;
  the Pro tactical brief is gated. Confirm the free experience alone is compelling enough
  to convert (or adjust what's gated).

**Acceptance Criteria**
- [ ] New user reaches a valuable teardown in < 2 min, measured, no dead ends.
- [ ] Every landing/onboarding claim has a working feature behind it (no aspirational copy).
- [ ] At least 1 non-founder confirms "I'd pay for this" after the free experience.

---

## Track 2 — FRICTION-TO-VALUE / ACTIVATION  ⬜
**Goal:** Shortest possible path from signup to "aha," instrumented so we know the drop-offs.

**Tasks**
- T2.1 — Instrument the funnel in PostHog: landing CTA → signup → first competitor added →
  teardown viewed → (return day 2). Define "activated" = added ≥1 competitor + viewed teardown.
- T2.2 — Remove steps: pre-fill example competitors, one-click "track this" from the demo,
  skip the welcome step if arriving with intent.
- T2.3 — First-value email: when the first teardown is ready, email the user a link back.
- T2.4 — Empty-state coaching on the dashboard before any change is detected (so day-1 free
  users aren't staring at nothing).

**Acceptance Criteria**
- [ ] Funnel dashboard live; activation rate visible per cohort.
- [ ] Median signup→aha steps ≤ 3 clicks.
- [ ] Activation rate ≥ 40% of signups (baseline to beat, then iterate).

---

## Track 3 — POSITIONING, LANDING & BRAND  ⬜
**Goal:** A crisp wedge and a landing page at Stripe/Firecrawl quality that converts.

**Tasks**
- T3.1 — Sharpen the wedge: lead with **AEO visibility** (track who AI assistants recommend)
  as the unique hook; pricing/tech/branding as the proof-of-depth.
- T3.2 — Rewrite hero + sections around one ICP (early-stage SaaS founder). One promise,
  one CTA, one proof.
- T3.3 — Add real proof as it arrives: first customer logos/quotes (replace the design-partner
  line only when true).
- T3.4 — Brand kit: voice, 1-line positioning, OG images, consistent rivaleye.app identity.
- T3.5 — Lighthouse/motion polish; reduced-motion respected (already partly done).

**Acceptance Criteria**
- [ ] One-sentence positioning a stranger can repeat back correctly.
- [ ] Landing Lighthouse ≥ 90 perf/SEO/a11y on mobile.
- [ ] Landing→signup conversion measured and ≥ 3% (baseline to beat).

---

## Track 4 — DISTRIBUTION / FIRST 10 CUSTOMERS  ⬜
**Goal:** A repeatable motion that produces paying customers — pick 1–2 channels, not six.

**Tasks**
- T4.1 — Name the first 10: a list of real, reachable early-stage SaaS founders who feel the
  AEO/competitor-pricing pain.
- T4.2 — Free public AEO/pricing trackers as a distribution wedge: the `/track/[slug]` and
  programmatic SEO pages already exist — seed 20–50 for real competitors, share each as a
  "here's what AI says about X" hook.
- T4.3 — Direct outreach: personalized "I ran RivalEye on your top competitor, here's the
  brief" → 30 sends/week, manual, founder-to-founder.
- T4.4 — One launch surface (Product Hunt OR a focused community) once T1/T2 are solid.
- T4.5 — Pick the single best-performing channel and double down; kill the rest.

**Acceptance Criteria**
- [ ] Written list of 10 named prospects with the channel to reach each.
- [ ] ≥ 50 qualified people reached/week through 1 channel.
- [ ] First 3 paying customers; then first 10. Documented CAC + what worked.

---

## Track 5 — ARCHITECTURE & CODE-STANDARDS HARDENING  ⬜
**Goal:** Keep velocity high and the codebase trustworthy as it grows.

**Tasks**
- T5.1 — SEC-5: move rate limiter from in-memory to Redis/Upstash (currently best-effort,
  ineffective across serverless instances).
- T5.2 — Pay down test-type debt: the 35 allowlisted test files with type errors (CI hides
  them) — fix fixtures so the suite truly type-checks.
- T5.3 — Reconcile the two analysis engines (vision teardown vs pricing-diff brief) — shared
  types / clear boundary, document which produces what.
- T5.4 — Fix sitemap path mismatch (`${comp}-pricing` vs generated plain slug).
- T5.5 — Verify/migrate infra subdomains off `.com` (PostHog ingress, R2 screenshots).
- T5.6 — Keep `npm run verify` green as the merge gate; expand the tenant-scoping guard usage.
- T5.7 — **Server-side Turnstile**: the widget is currently client-only (decorative,
  trivially bypassed by editing client state). Forward the token to a server route that
  calls Cloudflare `siteverify` and gate Supabase OTP/OAuth initiation on it.

**Acceptance Criteria**
- [ ] Rate limiting works across instances (load-tested).
- [ ] `npm run typecheck` (full, incl. tests) is clean — zero allowlist.
- [ ] No domain/SEO/infra inconsistencies remain.

---

## Track 6 — BOOTSTRAP vs RAISE  🅿️ (decide after 10 customers)
**Goal:** Choose the funding path from a position of evidence, not hope.

**Guidance**
- **Default: bootstrap to 10 customers first.** Pre-revenue, pre-retention, a raise is hard
  and dilutive; 10 paying customers + retention data is the cheapest possible "proof."
- Revisit a pre-seed raise only if: (a) clear retention + word-of-mouth, (b) a wedge that
  needs capital to win a land-grab (AEO is timely), and (c) the math says paid acquisition
  returns > cost. Otherwise keep compounding revenue + audience (the Firecrawl/Bun playbook:
  build in public, ship loudly, let distribution compound).

**Acceptance Criteria**
- [ ] Decision documented with the actual retention/CAC numbers behind it.

---

## Sequencing
**0 → 1 → 2 → (3 ‖ 4) → 5, with 6 deferred.** Track 0 unblocks everything. Finish Track 1's
live walk. Track 2 makes value land. Then run Track 3 (story) and Track 4 (distribution) in
parallel. Track 5 is continuous hygiene. Track 6 waits for evidence.

## Related
- Audit + fixes this session: PR #4 (`fix/promise-honesty-and-runtime-blockers`).
- Memory: canonical domain = rivaleye.app; AEO "your share" not built; two-engine architecture.
- Prior review: `docs/PRINCIPAL_REVIEW_AND_LAUNCH_TASKS.md`.
