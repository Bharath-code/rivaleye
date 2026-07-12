# RivalEye — Firecrawl-v2 Consolidation Blueprint

## Context

RivalEye's scraping engine grew into a 3-tier fallback (Firecrawl → Cheerio → Playwright)
plus a hand-rolled geo layer, a Gemini-vision pricing extractor, and two overlapping daily
pipelines. Firecrawl v2 now ships hosted equivalents for almost all of it: real geo proxies
(`location.country`), server-side `screenshot`, structured `json`/`branding`/`product`
extraction, and native `changeTracking` (git-diff + json diffing). This lets us delete
~1,400+ lines and a browser container while *improving* quality (real proxies vs. emulation),
then reinvest the savings into activation "wow" features.

**Scope decided with user:**
- Deliverable = **blueprint + savings estimate only**; user sequences execution.
- **Keep** the deterministic diff engine (`src/lib/diff/**`) and the AEO 5-model engine — these are the moat.
- **Replace** the crawler fallback + fake geo proxy, and Gemini *parsing* (extraction).
- Goal = **balanced**: consolidate the engine, spend the savings on new delight.

Firecrawl v2 facts verified against docs (`/websites/firecrawl_dev`):
- `scrape` `formats`: `markdown`, `screenshot` (fullPage/quality/viewport), `json` (schema|prompt),
  `changeTracking` (`modes: ["git-diff"|"json"]`, returns `changeStatus`/`previousScrapeAt`/`diff`), `branding`, `product`.
- `location: { country, languages }` = real regional proxy exit. `proxy: auto|basic|stealth`. `maxAge` caching.
- SDK already installed: `@mendable/firecrawl-js ^4.10.0`.

---

## Current-state complexity (measured)

| Area | Files / lines | Fate |
|---|---|---|
| Scraper cascade | `crawler/index.ts` (160), `cheerio.ts` (184), `playwright.ts` (275) | **Delete** — one Firecrawl call |
| Fake geo | `geoContext.ts` (98), `geoPlaywright.ts` (420) | **Delete** — `location.country` |
| Scraper heuristics | `decideScraper.ts` (120) | **Delete** — no fallback to choose |
| Vision pricing (Gemini) | `visionPricing.ts` (366) | **Delete** — `json` extraction |
| Screenshot capture | `screenshot.ts` (139) | **Delete** — `screenshot` format |
| Tech-stack detect | `techStackDetector.ts` (574) | **Keep logic, drop Playwright** — parse Firecrawl `rawHtml` |
| Branding | `brandingExtractor.ts` (368) | **Keep** — already on Firecrawl `branding`; dedupe client |
| Diff engine | `diff/**` (pricingDiff/alertRules/isMeaningful) | **Keep unchanged** (moat) |
| AEO | `aeo/**` (~1,194) | **Keep** (moat); optional gateway unify |
| Duplicate daily pipelines | `dailyPricingAnalysis.ts` + `dailyAnalysis.ts` (both `0 6 * * *`) | **Merge into one** |

Playwright is imported by 6 files; once all route through Firecrawl the dependency **and the
Trigger.dev Playwright build extension** (`trigger.config.ts`) are removed → smaller container,
faster cold starts, lower compute.

---

## Target architecture

### One extractor replaces the cascade
New `src/lib/crawler/scrapePage.ts` (~250–300 lines) wrapping a single Firecrawl `scrape`:

```ts
firecrawl.scrape(url, {
  location: { country, languages },            // real geo (was geoContext emulation)
  proxy: 'auto',                               // stealth on retry
  maxAge: 600_000,                             // cache; skips redundant fetches
  formats: [
    'markdown',
    { type: 'json', schema: PRICING_SCHEMA },  // replaces visionPricing + DOM extractor
    { type: 'changeTracking', modes: ['json'], schema: PRICING_SCHEMA }, // cheap pre-filter
    'screenshot',                              // replaces Playwright capture (still store to R2)
  ],
})
```

- `PRICING_SCHEMA` = Zod/JSON-Schema mirror of existing `PricingSchema` (`src/lib/types.ts`) so
  the **deterministic diff engine consumes it unchanged**.
- `changeTracking.changeStatus === 'same'` → short-circuit: skip diff/AI/alerts entirely (cost cut).
- Firecrawl `screenshot` returns an image → keep `screenshotStorage.ts` (R2 upload) and
  `guardrails.ts` (Supabase cooldowns) — those are app logic, not scraping.

### Gemini reduced to generation-only
Extraction moves to Firecrawl `json`. Gemini/AI stays **only** for narrative:
`diff/pricingInsights.ts`, `performanceRecommendations.ts`, alert copy. Vision *analysis*
(`visionAnalyzer.ts`) narrows to the narrative brief; structured facts come from Firecrawl
`json`/`branding`. Net: vision-token spend drops sharply; all deterministic fallbacks stay.

### One pipeline, deterministic scheduling
Merge `dailyAnalysis.ts` into `dailyPricingAnalysis.ts` → single `checkPricingContext` worker
that scrapes once and fans structured formats to pricing-diff + branding + tech + performance.
Replace `Math.random()` frequency-decay (`shouldCheckContext`) with a deterministic
last-change-age rule (testable).

### Optional: unify mainstream LLM calls (simplification, not moat change)
Route Gemini/OpenAI/Anthropic through **Vercel AI Gateway** (`provider/model` strings, AI SDK)
for one call style + fallbacks + observability. Perplexity `sonar` and SerpAPI stay bespoke
(not on gateway). Collapses 4 call styles → 2.

---

## "Wow" features funded by the savings (balanced goal)

1. **Instant teardown on paste (activation holy-sh*t moment).** Pre-signup: paste a URL →
   synchronous Firecrawl `scrape` (`json` pricing + `branding` + `screenshot`, ~seconds) →
   render a live competitor teardown before the user creates an account. Feasible now because
   extraction is hosted/fast; impossible when it needed a Playwright cold start.
2. **Real before/after diff feed.** Surface `changeTracking` `git-diff` text as highlighted
   before→after ("Pro went $49 → $59"), instead of an opaque "something changed" alert.
3. **Credible real-geo pricing.** "Germany pays 20% more" now backed by real EU proxy exits,
   not locale spoofing — a claim we can actually stand behind.

---

## Savings estimate

- **Code:** delete ~1,760 lines (index/cheerio/playwright/geoContext/geoPlaywright/decideScraper/
  visionPricing/screenshot), add ~300 → **net −1,400+ lines**.
- **Infra:** remove `playwright` + `cheerio` deps and the Trigger.dev Playwright build extension →
  smaller image, faster cold starts, lower per-run compute.
- **Per-scan cost:** Firecrawl `json` + `changeTracking` replaces Playwright compute **and**
  Gemini-vision tokens; `changeStatus==='same'` skips downstream LLM calls on unchanged pages
  (the common case) — compounding savings on the daily fan-out.
- **Quality up, not just down:** real proxies, structured extraction (fewer vision hallucinations),
  human-readable diffs.

---

## Suggested sequence (user owns ordering)

Each phase is independently shippable and guarded so it can land without a big-bang cutover.

1. **P1 — Extractor swap (behind flag).** Add `scrapePage.ts`; feed `json` pricing into the
   existing diff engine; run shadow vs. Playwright output for N competitors to confirm parity.
2. **P2 — Cut geo + screenshot to Firecrawl.** `location.country` + `screenshot` format; keep R2.
   Delete `geoContext`/`geoPlaywright`/`screenshot.ts`.
3. **P3 — Delete the cascade + Playwright dep.** Remove Cheerio/Playwright tiers, `decideScraper`,
   `visionPricing`, and the Trigger build extension. Update the 6 importers.
4. **P4 — DONE (2026-07-12).** Merged the two daily pipelines. `dailyPricingAnalysis` is now the
   sole 6am UTC cron entrypoint; it fires the extracted `visionAnalysisContext` child task once
   per competitor (not per pricing-context, and not a second competitor fetch). `dailyAnalysis.ts`
   was slimmed rather than deleted — `userSchedules.ts`/`/api/schedule` still attach PRO=6h /
   ENTERPRISE=hourly custom cadences to its task id — it now just loops competitors and calls
   `visionAnalysisContext.trigger()`, no duplicated business logic. `shouldCheckContext`'s
   frequency-decay `Math.random()` replaced with `stableFraction()` — a sha256 hash of
   `competitorId:contextId:date` mapped to [0,1), deterministic per day (testable) while still
   rotating which competitors get skipped day to day.
5. **P5 — DONE (2026-07-12).** Instant teardown shipped. `POST /api/public/teardown`
   (unauthenticated, per-IP rate-limited via `RATE_LIMITS.teardown`, 5/10min) reuses
   `scrapePricing()` synchronously with `captureScreenshot=true` — one Firecrawl call
   returns pricing plans + a hosted screenshot URL, no DB write, no R2 upload (ephemeral
   pre-signup preview). Landing page (`InstantTeardown.tsx`) renders it inline with a
   "Track This Free" CTA into `/login`. Existing SSRF guard (`validateCompetitorUrl`) and
   the tenant-scoping guard are unaffected (route touches no tenant tables). Known gap:
   no bot challenge (Turnstile) in front of it yet — rate limit alone gates abuse for now.
6. **P6 — DONE (2026-07-12).** Unified the Gemini generation-only call sites
   (`pricingInsights.ts`, `techStackAlerts.ts`, `brandingAlerts.ts`,
   `performanceRecommendations.ts`) onto `aiProvider.generateText()`, which now
   routes through Vercel AI Gateway (`google/gemini-2.0-flash`, OpenAI-compatible
   endpoint via the already-installed `openai` SDK) when `AI_GATEWAY_API_KEY` is
   set, falling back to direct `@google/genai` → OpenRouter unchanged otherwise —
   no new dependency, zero-downtime opt-in. Collapsed 4 duplicated
   instantiate-parse-catch blocks into 1. `visionAnalyzer.ts` (image input) and
   `aeo/providers.ts` (5-model AEO moat, Anthropic/Perplexity/etc. stay bespoke
   per scope) were deliberately left untouched — different call shape / out of
   scope. `pricingInsights.ts`'s unused before/after-screenshot vision branch
   was dropped (dead code, zero callers passed it).

---

## Progress + corrected P3 scope (2026-07-07)

**Done and shipped (flag-gated, on `feat/firecrawl-consolidation`):**
- P1 extractor (`scrapePage.ts`), P2 screenshot+geo glue — committed earlier.
- **P3 rewire (`25cca18`)**: `checkPricingContext` dual-paths behind `FIRECRAWL_EXTRACTOR`
  (flag on → `scrapePricing`; flag off → Playwright geo path, still the default). Reversible;
  no cutover yet.
- **Parity validated**: Firecrawl extraction correct on 8 live SaaS pricing pages (ground-truth
  eyeball; the automated Playwright control couldn't run locally — no browser). No `price_raw`
  normalization needed: the diff engine already numeric-normalizes via `extractNumericPrice`.
- **Automated gate wired (`6634773`)**: opt-in `shadow-parity` CI job (`scripts/shadow-parity.test.ts`).

**The deletions are NOT a clean tail — corrected scope, blocked in this order:**
1. **The gate imports what the deletion removes.** `scripts/shadow-parity.test.ts` imports
   `scrapeWithGeoContext` from `geoPlaywright.ts` to compare against. The gate MUST run green
   *before* `geoPlaywright` is deleted — deletion can't precede or coexist with it.
2. **The gate needs the `FIRECRAWL_API_KEY` repo secret** (GitHub UI). Until it's added and the
   job is green, the cutover is unauthorized.
3. **The flag defaults OFF**, so the current default pricing path *is* `geoPlaywright`. Deleting
   it forces an unproven Firecrawl-only cutover — do only after (1)+(2).

**`playwright` is load-bearing for FIVE modules, not just the pricing cascade:**
`geoPlaywright`, `visionPricing`, `screenshot.ts` (pricing/vision) **plus** the survivors
`techStackDetector`, `performanceInsights`, and the trigger jobs `analyzeCompetitor` +
`dailyAnalysis`. So "remove the `playwright` dep + Trigger build extension" only pays off once
**all five** consumers are migrated. Piecemeal migration removes no dependency.

- **`techStackDetector` → Firecrawl `rawHtml` regresses detection**: Firecrawl gives html +
  `<script src>` tags but NOT runtime `window` globals and NOT response headers. That drops all
  `globals` signatures and header-only signatures (Netlify, AWS CloudFront, primary Vercel/
  Cloudflare via `cf-ray`/`x-vercel`). Only worth doing as part of the full 5-module migration,
  not alone.

**Recommended remaining sequence (revised):**
- **P3a — DONE (2026-07-10).** Cutover executed on user authorization *without* the automated
  Playwright-control gate (user declined the local browser install; evidence = 8/8 ground-truth
  pages + 5/5 live Firecrawl extraction on the CI default URL set). Deleted the pricing cascade
  (`geoPlaywright`/`geoContext`/`decideScraper`/`visionPricing`/`cheerio.ts`/`playwright.ts`),
  the `index.ts` barrel (no external consumers), the `cheerio` dep, the `FIRECRAWL_EXTRACTOR`
  flag (no fallback left to gate), and `bestScraper` plumbing. `checkPricingContext` is
  Firecrawl-only. The shadow-parity script/CI job became a live Firecrawl extraction smoke test
  (still opt-in, still needs the `FIRECRAWL_API_KEY` repo secret — not yet added). Bonus fix:
  `uploadScreenshot` now sniffs PNG/JPEG magic bytes instead of mislabeling everything
  `image/webp`. KEPT `playwright` dep, `screenshot.ts`, and the Trigger extension (survivors
  still need them).
- **P3b — DONE (2026-07-11).** Playwright fully removed. `screenshot.ts` rewritten on Firecrawl
  (full-page screenshot format + `fetchScreenshotBuffer`, returns sniffed `contentType` for
  Gemini). `techStackDetector` now uses Firecrawl-rendered HTML (`formats: ["html"]`, script srcs
  parsed from markup) + a plain `fetch` for response headers — header signatures (cf-ray,
  x-vercel, x-nf, x-amz-cf) survive; only `window` globals signatures were dropped (accepted
  tradeoff). `performanceInsights.ts` deleted outright — it had zero callers (deepAudit already
  uses Google PageSpeed Insights). `analyzeCompetitor` + `dailyAnalysis` inline chromium blocks
  replaced with `captureScreenshot()`. Removed: `playwright` + `@trigger.dev/build` deps and the
  Trigger.dev playwright build extension. `pricing_snapshots.source` now written as "firecrawl"
  everywhere (old rows keep "playwright"; the type union keeps both for reads).

---

## Verification

- **Parity first:** shadow-run `scrapePage.ts` vs. current Playwright/Gemini path on ~10 live
  competitors; assert the produced `PricingSchema` and resulting diffs match (P1 gate).
- `npm run verify` (typecheck:ci + vitest + build) green after each phase; add tests for the new
  extractor and the deterministic scheduler (replaces the untestable `Math.random()`).
- Confirm `src/lib/diff/**` tests are untouched (moat unchanged).
- Manual: paste a real competitor URL through the P5 teardown and eyeball pricing/branding/screenshot.
- Tenant-scoping guard test (`tenant-scoping.guard.test.ts`) stays green if any routes change.

## Out of scope (flagged, not doing here)
- `alerts` table column bloat + 3 snapshot models (`snapshots`/`analyses`/`pricing_snapshots`) —
  legacy `snapshots` looks unused; worth a separate schema-cleanup pass.
- `competitor_embeddings`/OpenAI RAG is built but not in the monitoring flow — decide keep vs. cut later.
- Per-job `getSupabase()` boilerplate → share `src/lib/supabase.ts` (trivial follow-up).
