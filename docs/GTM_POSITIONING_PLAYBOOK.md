# RivalEye — GTM & Positioning Playbook

**Date:** 2026-07-17
**Depends on:** `docs/superpowers/plans/2026-07-17-aeo-share-of-voice.md` (PAR-1 own-brand share-of-voice, free AI-visibility checker, PAR-2 citation tracking). Positioning below is only honest once those ship — don't market what can't be demoed.

---

## 1. Positioning

**Trap to avoid:** "competitor monitoring tool" is owned — Visualping at $10/mo, Klue at $15k/yr. "AI visibility" has no SMB-priced default: Profound anchored $499/mo enterprise, Peec €89.

**Positioning statement:**

> For SaaS founders and marketers watching search traffic die, **RivalEye is the only tool that shows your share of AI answers vs your competitors — and tells you *why* you're losing it.** Peec and Otterly give you a score. RivalEye watches your competitor's pricing, positioning, and pages at the same time, so when your share drops, you get the cause and the counter-move, not just a number.

**The genuine differentiator:** AEO trackers don't crawl competitor sites; site monitors don't query LLMs. RivalEye does both, and the AI tactical brief connects them.

**The word we own:** **"share of AI answers."** Use it in the H1, the weekly email subject, the dashboard hero number — everywhere, until it's ours.

**Who we're NOT for (say it publicly):** enterprises wanting battlecards/CRM integrations, agencies running 50 brands (later, via Agency tier), local businesses. We're for the SaaS founder/marketer with 2–10 competitors who checks their own name in ChatGPT and feels their stomach drop.

---

## 1b. Competitive landscape (post-repositioning)

- **Primary (comparison we invite):** AEO trackers — **Otterly ($29)**, **Peec (€89)**, **Profound ($499)**. Fight on: they give a score; we give score + cause + counter-move. `/vs/` pages target these three by name.
- **Real competitor at SMB:** *doing nothing* — a founder typing their name into ChatGPT monthly. The free checker converts that behavior.
- **Secondary (stop comparing publicly):** Visualping/Fluxguard, Competitors.app. Capability overlap, but comparing drags us back into the category we're leaving.
- **Not competitors:** Klue/Crayon — different buyer/price (per `docs/COMPETITIVE_PARITY_GUIDE.md`).
- **The one to watch:** **Semrush/Ahrefs adding AI-visibility features.** Distribution to flatten standalone AEO trackers. Our defense = the coupling they won't build (AI visibility × competitor page/pricing intelligence). This threat is why PAR-1 ships now, not eventually.

## 1c. Existing features under the new positioning

Repositioning reorders the story, not the product. Two-loop structure: the AEO loop says *you're losing*; the monitoring loop says *why*; the brief says *what to do*. Peec/Otterly are single-loop (measure + report only) — every "old" feature slots into loop two.

| Existing feature | New role | Verdict |
|---|---|---|
| AEO scanning (5 models) | Hero — "share of AI answers" once PAR-1 ships | Promoted |
| Pricing diff engine + severity rules | "The why behind the number" — no AEO tracker has this | Core differentiator |
| AI tactical briefs | "The counter-move" | Core differentiator |
| Alerts + noise filtering + history | Retention engine; feeds weekly share email | Complements |
| Deep audit / instant teardown (P5) | Pre-signup wow + fuel for first-10 outreach reports | Complements |
| Screenshots + vision analysis | Evidence inside briefs | Supporting |
| Public `/track/`, `/vs/`, `/for/` pages | Programmatic SEO loop — retarget copy to AI-visibility queries | Repurposed |
| Tech stack / branding / perf alerts | Keep in product, drop from marketing | Demoted |
| 4-region geo crawling | Checkbox claim, never a headline (emulated — known ceiling) | Demoted |
| Market radar / check-now | Utility | Neutral |

Casualties (un-built only): PAR-5/6 (element-scoped monitoring) drop further down the backlog; PAR-8 (social/jobs) stays dead — they pull toward categories we're leaving. Consistent with the parity guide's sequencing.

## 1d. The moat

**Today: none.** Scanning, diff engine, briefs, price — all replicable engineering; what we have is speed + an unclaimed position. The moat gets *built*, and the architecture defines which one:

**The correlation dataset (the real moat).** We are the only product collecting both sides of a cause-and-effect pair, daily, timestamped: (A) what competitors changed — pricing/positioning/pages, and (B) how AI answer share moved — per model, per query. Peec/Otterly/Profound have only B; Visualping only A; a Semrush entrant starts with neither history. LLM answers are ephemeral — last quarter's ChatGPT responses cannot be backfilled by anyone, ever. After 12–18 months this compounds into the proprietary answer to "what actually moves AI visibility?" → prescriptive, evidence-based AEO advice ("adding a comparison page gained avg +9 share points within 3 weeks") vs everyone else's generic checklists.

**Supporting moats:**
1. *Per-customer switching cost via history* — 8 months in, leaving means restarting the chart from zero (Semrush's moat, miniaturized). Accrues from customer one — starts only when PAR-1 records own-brand data.
2. *Being the answer ourselves* — programmatic pages cited by LLMs for "[X] alternatives" queries = occupying the distribution channel we sell visibility into. Verifiable via PAR-2.
3. *The weekly-number habit* — retention loop; the closest thing SMB SaaS has to a behavioral moat.

**Not the moat (don't invest as if it were):** the pipeline, parser, diff rules, briefs, "$49", "5 models × 4 regions" — delivery mechanism, not moat.

**Strategic consequence:** moat = time × customers scanning daily. Every month of delay before PAR-1 is a month of unrecordable history — for us and every future customer. Speed to data collection is the whole game.

---

## 2. First 10 customers — sell the report, not the product

The product generates a personalized painkiller artifact for free. Use it manually before the checker ships publicly.

1. **List 100 targets** where the pain is hottest: Product Hunt launchers from the last 90 days, founders posting on X/LinkedIn about declining Google traffic, r/SaaS and Indie Hackers posters asking "how do I get mentioned by ChatGPT."
2. **Run their check ourselves** (own scan pipeline) and send cold: *"Asked ChatGPT and Perplexity 5 questions about [category]. [Competitor] appears in 7 of 10 answers. You appear in 1. Full report attached — want me to track this weekly?"* Diagnosis, not outreach. Expect 20–40% replies — the email contains their own bad news.
3. **Founding-customer offer:** $29/mo locked forever (vs $49) in exchange for a 20-min call after week two. Ten calls = the sales playbook written in customer language → becomes landing copy.
4. **30 days of this before any public launch.** First customers manually → prove retention → then scale. If 10 hand-delivered reports can't convert, a launch won't save it.

---

## 3. GTM sequence

Motion: **PLG** (passes readiness: value in first session via checker; no setup; $49 = credit-card decision).

| When | What |
|---|---|
| Weeks 1–4 | Manual outreach (above) while PAR-1 + checker ship. Every manual report doubles as wedge-feature QA. |
| Week 5 | Soft launch the free checker (no PH). Post own results on r/SaaS, Indie Hackers, X: "I asked 5 AIs about [category]; here's who they recommend — free tool to check yours." Goal: 300 runs, capture emails. |
| Week 8 | Product Hunt launch with **the free checker as the product** ("Check if AI recommends you — free"), not the suite. |
| Ongoing | **Master one channel: programmatic SEO.** Existing `/vs/`, `/for/[industry]`, `/track/[slug]` + new pages targeting "is [brand] recommended by ChatGPT", "[competitor] AI visibility." These pages get cited by answer engines themselves — verifiable via PAR-2. Dogfood publicly: "We used RivalEye to make RivalEye the AI answer for AEO tools." |

## 4. Growth loops (priority order)

1. **Checker → email → weekly "your share of AI answers: 12% (↓3)" email → upgrade.** The weekly email is the retention engine — a moving number about yourself is the most reopened email format.
2. **Shareable score badge/image** on checker results — founders post scores.
3. **Programmatic pages → search + AI citations → checker.**

**Skip entirely:** paid ads (nothing proven to scale), Discord community, referral program (K ≈ 0.05, not viral — don't pretend).

**Metrics:** activation = `first_brief_viewed` (already instrumented) + first own-share render; retention = weekly email opens; conversion = checker → signup → paid.

---

## 5. Revenue path

- 10 founding customers ≈ **$300 MRR** → proof, playbook, testimonials.
- 100 customers @ $49 ≈ **$5k MRR** — realistic at ~2% checker→paid on ~5k checker runs; margins protected by diff-gated AI spend.
- **Free tier stays tight** (1 competitor, weekly scan, own score only) — Gemini free-tier ~1,000 req/day ceiling makes generous free a liability.
- **Annual at $490** immediately (cash flow + churn lock).
- Later: **$99 Agency tier** (multi-brand workspaces) — agencies are the serial buyers of AEO tools.
- **Do not drop to $19.** Price is the last refuge of the undifferentiated; "why + counter-move" justifies $49. `PLAN_PRICING` in `src/lib/billing/featureFlags.ts` remains the single source.

---

## 6. Landing page copy

**Hero:**

> *(eyebrow)* SHARE OF AI ANSWERS
>
> **H1:** When someone asks ChatGPT for the best tool in your category — are you the answer?
>
> **Sub:** RivalEye tracks how often ChatGPT, Perplexity, Claude, Gemini and Google AI recommend you vs your competitors — and when you lose ground, tells you exactly what they changed to win it.
>
> **Primary CTA:** Check your AI visibility — free · **Secondary:** Start tracking daily
> *(under CTA)* No signup for the check. No credit card for the trial.

**Section flow:**
1. The free checker widget itself (the hero demo IS the section)
2. "Your 12% vs their 43%" — share-of-voice screenshot
3. "The why behind the number" — pricing/positioning change detection feeding the score
4. "The counter-move" — AI tactical brief
5. "Where AI gets its answers" — citation sources (PAR-2)
6. Pricing

**Near pricing:** *"Profound charges $499 for this. We think every founder deserves to see themselves."* · *"5 answer engines. 4 regions. Every day. One number."*

**Kill/demote** any copy leading with "monitor competitor pricing pages" — it's supporting evidence now, not the promise.

---

## 7. Brand — evolve, don't rebrand

Current identity (dark UI, emerald accent, glass cards, radar/"Deploy Your First Sensor" military metaphor) is ~70% right. Full rebrand = equity reset for zero gain. Change the **metaphor**, keep the palette.

- **Metaphor shift:** "sensor/surveillance" says *spying on them*; the new story is *being seen*. Move language from military (deploy, sensor) toward optics/signal: *your visibility, your share, your signal, blind spots, "the answer."* Keep "tactical brief" — the one military term customers love. Rename onboarding step 1: "Deploy Your First Sensor" → "See where you stand."
- **Color system, semantically hardened:** near-black background stays; **emerald = you** (make it law), **slate/neutral = competitors**, amber = share slipping, red = share lost. One accent, one meaning.
- **Logo:** the name RivalEye survives the pivot — an eye watching rivals *and* the eye AI sees you with. Minimal eye mark, iris as radar-sweep/spark. Flat, single color, legible at 16px favicon.
- **Typography:** keep display/body split — geometric display (Space Grotesk-class) for numbers/headlines, Inter body, JetBrains Mono for scores/data. Enforced rule: **the share number is always the biggest thing on any screen.** Deltas ("↓3 this week") next to every number; you-vs-them on every surface.
- **UX north star:** every screen answers exactly one of three questions — *What's my share? Why did it move? What do I do about it?* Anything not serving one of those is a deletion candidate.

---

**TL;DR:** Own "share of AI answers." Get 10 customers by hand-delivering their own bad news. Let the free checker do the marketing the suite never could. The moat is the change→share-movement correlation dataset that starts recording the day PAR-1 ships — and not a day before.
