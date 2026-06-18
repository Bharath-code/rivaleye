# CLAUDE.md — RivalEye

Competitive-intelligence SaaS. Monitors competitor **pricing, tech stack, branding, performance, and AEO (answer-engine / LLM) visibility** across 4 regions, and turns each change into an AI tactical brief. Next.js 16 + Supabase + Trigger.dev.

## Commands

```bash
npm run dev          # Next dev (Turbopack)
npm run typecheck    # tsc --noEmit
npm run test:run     # Vitest (one-shot)  — 557 tests / 49 files
npm run verify       # typecheck:ci + test:run + build  ← run before declaring done
npm run lint         # ESLint (max-warnings 200, non-blocking)
```

## Architecture (where things live)

- `src/app/api/**` — 27 route handlers. Tenant routes use `getUserId()` + `assertSameOrigin()` + `checkRateLimit()`.
- `src/lib/diff/**` — deterministic pricing diff + alert rules. **AI never decides what's important; these rules do.** Severity weights in `pricingDiff.ts`, alert gating in `alertRules.ts`, noise filter in `isMeaningful.ts`.
- `src/lib/crawler/**` — 3-scraper fallback (Firecrawl → Playwright → Cheerio) + geo proxy + guardrails + screenshots (R2).
- `src/lib/aeo/**` — AEO scan: queries N prompts × 5 models (ChatGPT/Perplexity/Claude/Gemini/Google AI), parses brand mentions, computes `visibility_pct`.
- `src/lib/ai/**` — vision analyzer, insight/brief generator, embeddings.
- `src/lib/billing/featureFlags.ts` — `PLAN_LIMITS` (free / pro / enterprise) is the single source of plan gating.
- `src/trigger/**` — background jobs (daily pricing, daily analysis, deep audit, AEO monitor, retention).
- `src/lib/{auth,csrf,rateLimit,urlValidator,quotas,encryption}.ts` — security/limit primitives.

## Conventions

- **Validate at the edge with Zod** (`src/lib/validation/schemas.ts`) — `parseBody` / `parseQuery`.
- **Mutating routes** (POST/PATCH/DELETE) must call `assertSameOrigin(request)` first, then auth, then rate limit, then quota.
- **Logging:** structured pino via `withRequestId` / `withUser`; capture 5xx to Sentry. Avoid bare `console.log` in routes (some legacy ones exist — don't add more).
- **Tests:** colocated `__tests__/*.test.ts`. Add tests with any logic change; keep `npm run verify` green.
- TypeScript strict; no comments unless they explain non-obvious *why*.

## Known risks / gotchas (see `docs/PRINCIPAL_REVIEW_AND_LAUNCH_TASKS.md`)

- **`createServerClient()` uses the service-role key → RLS is bypassed.** RLS is enabled in `schema.sql`, but service-role ignores it, so every tenant query MUST still filter by `user_id`. A CI guard (`src/app/api/__tests__/tenant-scoping.guard.test.ts`) enforces this — if you add a non-user-scoped route, allowlist it there with a justification.
- **Pricing single source of truth = `PLAN_PRICING` in `src/lib/billing/featureFlags.ts`** ($49 Pro). Don't hardcode prices elsewhere.
- **Rate limiter is in-memory** → ineffective across serverless instances; treat as best-effort until moved to Redis/Upstash (SEC-5, open).
- **`supabase/migrations/20260615_public_slug.sql` must be applied** for the public `/track/[slug]` route to work (indexed lookup). `public_listed` defaults true (public-by-default — product decision).
- **AEO scans are cost-capped** via `AEO_MAX_QUERIES_PER_SCAN`, `AEO_SCAN_CONCURRENCY`, `AEO_SCAN_COST_CEILING_USD` env vars.
- **Free-tier scaling ceiling** ≈ Gemini ~1,000 req/day project-wide (`docs/unit_economics.md`).

## Verdict (2026-06-15)

PURSUE / conditional GO. AEO visibility is the wedge to lead with. P0 security (SEC-1, SEC-2), pricing reconciliation (BIZ-1), and the scoring rework (CALC-1..4) are **done**; SEC-4/PERF-1 + SEC-3 guard + PERF-3 done. Open: SEC-5 (rate-limit provider), UX activation, motion/Lighthouse polish. Full review + progress log + acceptance criteria: `docs/PRINCIPAL_REVIEW_AND_LAUNCH_TASKS.md`.
