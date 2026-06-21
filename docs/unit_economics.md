Excellent — this locks in **unit economics discipline**. I’ll deliver this in **three clean sections**, each written so you can hand it directly to Cursor and implement with confidence.

---

# 1️⃣ Per-User Quotas (Clean, Predictable, Non-Annoying)

## Design Principles

* Quotas should **never surprise** users
* Free users should **never hit a wall mid-value**
* Pro users should feel **unlimited**, but still bounded internally
* Quotas must protect **Firecrawl + AI spend**, not punish usage

---

## Quota Model (Authoritative)

### Core Quota Dimensions

You only need **three**:

1. **Active monitored pages**
2. **Crawls per day**
3. **Manual checks per day**

Do **not** quota alerts, emails, or AI calls directly — those are derived.

---

## Tier Quotas (MVP → Scalable)

### Free Tier

| Metric             | Limit     | Why                   |
| ------------------ | --------- | --------------------- |
| Active pages       | **1**     | Matches indie reality |
| Scheduled crawls   | **1/day** | Predictable cost      |
| Manual “Check now” | **1/day** | Prevent spam          |
| Failure retries    | **0**     | Protect budget        |

> Free users should *never* feel rushed — just limited in scale.

---

### Pro Tier ($49/mo)

> **Pricing reconciliation (BIZ-1, 2026-06-15):** canonical Pro price is **$49/mo**
> (live on the landing page + README; $39 launch promo, $468/yr annual). The
> single source of truth in code is `PLAN_PRICING` in
> `src/lib/billing/featureFlags.ts`. Earlier "$19" figures in this doc were stale
> and have been corrected.

| Metric           | Limit                       | Why                       |
| ---------------- | --------------------------- | ------------------------- |
| Active pages     | **Unlimited (soft cap 25)** | Real usage rarely exceeds |
| Scheduled crawls | **Hourly max**              | Serious users             |
| Manual checks    | **5/day**                   | Power without abuse       |
| Failure retries  | **1 retry**                 | Reliability               |

Internally enforce a **soft cap** (e.g. 25 pages) to prevent abuse — surface higher needs later as “Contact us”.

---

## Database Schema (Simple & Clean)

```ts
UserQuota {
  userId
  tier: "free" | "pro"
  activePages
  crawlsToday
  manualChecksToday
  lastResetAt
}
```

Reset counters **daily at UTC midnight**.

---

## Guardrail Logic (Must Exist)

```ts
function canCrawl(user, page, type) {
  if (user.tier === "free") {
    if (type === "scheduled" && user.crawlsToday >= 1) return false
    if (type === "manual" && user.manualChecksToday >= 1) return false
  }

  if (user.tier === "pro") {
    if (type === "manual" && user.manualChecksToday >= 5) return false
  }

  return true
}
```

### UX Rule (Important)

When blocked:

> “You’ve reached today’s limit. We’ll check again tomorrow.”

No upsell **unless** they try to add a second page.

---

# 2️⃣ Pricing Tied to Crawl Volume (Without Saying “Crawls”)

Users don’t think in crawls.
They think in **coverage and confidence**.

So pricing is **implicitly** tied to crawl volume, not explicitly.

---

## Pricing Philosophy

> Charge for **how much surface area you watch**, not how often you ping it.

This keeps pricing:

* Simple
* Predictable
* Trustworthy

---

## Pricing Structure (Recommended)

### Free

* 1 competitor
* Daily monitoring
* Descriptive alerts

### Pro — $49/month

* Unlimited competitors (soft cap)
* Faster checks
* Deeper interpretation
* Alert filtering
* Full history

Internally:

* You cap crawl volume
* User never sees the word “crawl”

---

## Optional Future Tier (Only If Needed)

### Power — $49/month (Later)

* Higher crawl frequency
* Higher page cap
* Priority crawling
* API access

**Do not launch this early.**
Only add when users ask.

---

## Why This Works Economically

* 90% of users track ≤3 pages
* 95% of pages don’t change daily
* AI calls only happen on meaningful diffs

You’re pricing on **perceived value**, not raw cost.

---

# 3️⃣ Worst-Case Cost Scenarios (Reality, Not Hopium)

Let’s stress-test this so you *don’t die quietly*.

---

## Assumptions (Conservative)

*   Gemini 3 Flash: **$0.50/M input, $3.00/M output** (No fixed plans)
*   Firecrawl Hobby: **$19/mo** (3,000 credits, ~$9/extra 1k)
*   Trigger.dev Pro: **~$30/mo** (20+ concurrent, $10/50 extra runs)
*   Resend: **3,000 emails/month free** (Usage-based after)
* Email cost: negligible

---

## Scenario A — Free Tier Management (The 1k Wall)

### 1,000 Free Users
* 1 page each
* 1 crawl/day

**Daily Analysis Needs:**
1,000 requests/day

🔥 **The Guardrail:**
Since Gemini 3 Flash is capped at **~1,000 requests/day** Project-wide, Scenario A is our "Sustainability Ceiling" for the Free Tier. To scale beyond 1,000 daily active free users, we must:
1. Move to the **Pay-per-use** tier ($0.50/M tokens).
2. Implement **Frequency Decay** (checking low-volatility pages less often).
3. Introduce a "Waiting List" for new free users.

---

## Scenario B — Pro Power Users (Still Safe)

### 500 Pro Users

* Avg 5 pages/user
* Hourly checks (max)

Raw theoretical:

* 500 × 5 × 24 = 60,000 crawls/day ❌

### Reality with Guardrails:

* Soft cap pages (25)
* Early-exit hash checks
* Change rate ~5%

**Effective crawls/day:**
~15,000

**AI calls/day:**
~750

🔥 Result:

* Still bounded
* Pro revenue massively exceeds cost
* Margins intact

---

## Scenario C — Malicious / Misconfigured User (Handled)

### User tries to:

* Add 100 pages
* Spam manual checks
* Monitor volatile pages

### Guardrails stop:

* Page caps
* Manual limits
* Failure backoff
* De-duplication

🔥 Result:

* Cost contained
* No service degradation

---

## Kill-Switch (Must Exist)

Add a global safety valve:

```ts
if (globalDailyCrawls > MAX_SAFE_LIMIT) {
  pauseNewCrawls()
  notifyAdmin()
}
```

This protects you from:

* Bugs
* Loops
* Unexpected growth spikes

---

# Final Reality Check

With:

* Per-user quotas
* Implicit crawl pricing
* Early exits
* Meaningful diff filtering

👉 **Your costs scale sub-linearly with users.**

That’s the holy grail for AI SaaS.

---

