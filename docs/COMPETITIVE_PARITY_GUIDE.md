# RivalEye — Competitive Parity Completion Guide

**Date:** 2026-07-07
**Method:** Features ranked by product-surface weight (plan-gating + daily jobs + launch verdict). Live usage analytics not available — PostHog MCP pointed at an unknown project and Supabase connector unauthorized this session. Re-rank against real event data once PostHog is wired to the real project.

---

## 1. RivalEye's top 10 features (by product-surface weight)

| # | Feature | Where it lives |
|---|---------|----------------|
| 1 | Competitor pricing monitoring + deterministic diff/severity | `src/lib/diff/`, `src/trigger/dailyPricingAnalysis.ts` |
| 2 | AEO / LLM visibility scanning (5 models, `visibility_pct`) | `src/lib/aeo/`, `src/trigger/aeoMonitor.ts` |
| 3 | Alerts with noise filtering + history | `src/lib/diff/alertRules.ts`, `src/app/dashboard/alerts` |
| 4 | AI tactical briefs / insights per change | `src/lib/ai/`, `src/trigger/dailyAnalysis.ts` |
| 5 | Multi-region (4-region) geo-aware crawling (geo is emulated, not real IP rotation) | `src/lib/crawler/`, `crossRegionComparison.ts` |
| 6 | Screenshots + visual (vision) analysis | crawler R2 glue, `src/lib/ai/` vision analyzer |
| 7 | Deep competitor audit / analyze-competitor | `src/trigger/deepAudit.ts`, `/api/analyze-competitor` |
| 8 | Tech-stack, branding & performance change alerts | `src/lib/alerts/{techStackAlerts,brandingAlerts,performanceAlerts}.ts` |
| 9 | Public `/track/[slug]` + `/vs/` comparison pages (growth loop) | `src/app/track`, `src/app/vs` |
| 10 | Market radar + manual "check now" | `/api/market-radar`, `/api/check-now`, `canViewRadar` gate |

## 2. Competitor landscape

RivalEye straddles three categories — its differentiation, but also parity pressure from three directions.

- **Marketing monitors — Competitors.app** (~$15–20/competitor/mo): email/newsletter, blog, social, ads, SEO rank, traffic in a unified timeline; Slack + Zapier. Beats us on signal breadth + timeline UX; we beat them on pricing-diff rigor + AEO.
- **Website change monitors — Visualping** (from $10/mo): visual/text/**element-scoped** diffs, AI change summaries, email/SMS/Slack. **Fluxguard** (from $110/mo): DOM/JS/cookie diffing, PDF monitoring, webhook/Teams/Zapier. Gap: user-selectable page regions + alert-channel breadth.
- **AEO trackers — Peec AI (€89/mo), Profound ($499/mo), Otterly ($29/mo):** table stakes = daily prompt tracking, **share-of-voice vs named competitors**, citation/source analysis, filter by engine/geo/language/prompt-cluster, GEO audit (25+ on-page factors). Our `visibility_pct` is competitive, but **own-brand "your share" is not built** — the biggest AEO gap.
- **Enterprise CI — Klue / Crayon** ($15–16k/yr): battlecards, win/loss, CRM/Slack/Teams/Gong. **Do not chase** — different buyer/price. Our AI briefs are the SMB-priced miniature; positioning asset, not a parity gap.

## 3. Parity completion tasks (ordered by revenue-defensible gap, not feature-matching)

### P0 — AEO share-of-voice (closes gap with Peec/Otterly; our wedge)
- [x] **PAR-1** Capture user's own brand at onboarding; include in AEO scans so `visibility_pct` = "your share vs each competitor". (shipped 2026-07-17 — see docs/superpowers/plans/2026-07-17-aeo-share-of-voice.md)
- [x] **PAR-2** Citation/source tracking: store + rank URLs cited in model answers (Profound's core pitch). (shipped 2026-07-17 — see docs/superpowers/plans/2026-07-17-aeo-share-of-voice.md)

### P1 — Alert delivery parity (cheap, churn-prevention)
- [ ] **PAR-3** Generic outbound webhook per user (HMAC-signed). One table column + one POST; gets Zapier/Make compatibility free. Have email + Slack today (`src/lib/alerts/slackIntegration.ts`).
- [ ] **PAR-4** Alert digest option (daily/weekly rollup). Touches only the existing alert send path; reduces noise complaints.

### P2 — Change-monitoring depth (Visualping parity)
- [ ] **PAR-5** Element/region-scoped monitoring: user picks CSS selector / region instead of whole-page. Per-page config field + scoped diff; crawler already fetches HTML + screenshots.
- [ ] **PAR-6** AI change summaries on any watched page (generalize the pricing brief generator to arbitrary diffs).

### P3 — Signal breadth (Competitors.app parity — validate demand first)
- [ ] **PAR-7** Blog/changelog monitoring (RSS + page diff on `/blog`, `/changelog`). Low cost, high perceived value.
- [ ] **PAR-8** Job-postings / social monitoring — **defer**; expensive, drags toward Competitors.app's category and away from the AEO wedge.

### Explicitly skip
Battlecards/win-loss (Klue territory) · SEO rank tracking (crowded, Semrush-adjacent) · real IP-based geo rotation (emulated geo is a known ceiling — fix only on customer complaint; ref memory `geo-proxy-is-emulated`).

**Sequencing:** P0 ≈ next sprint (strengthens launch wedge) · P1 ≈ a few days · P2/P3 post-launch, driven by activation data once PostHog is on the real project.
