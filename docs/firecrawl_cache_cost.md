Perfect — this is the **last piece that separates a toy MVP from a sustainable SaaS**.

Below is a **production-grade Firecrawl cost + caching strategy** designed for:

* Indie-scale budgets
* Predictable spend
* High alert quality
* Zero wasted crawls



---

# 🔥 Firecrawl Cost & Caching Optimization (Authoritative)

## Core Principle (Do Not Violate)

> **Never crawl a page unless there is a realistic chance the result will produce a meaningful alert.**

Everything below enforces that rule.

---

## 1️⃣ Crawl Less Than You Think You Need To

### MVP Crawl Frequency (Hard Rules)

* **Default:** 1× per day per page
* **Manual “Check now”:** max 1× per user per day
* **No retries unless explicitly triggered**

❌ No hourly checks
❌ No “just in case” crawls
❌ No background refreshes

This alone reduces cost by **70–80%** vs naive implementations.

---

## 2️⃣ Page Eligibility Filter (Before Firecrawl)

Before calling Firecrawl, run this **cheap pre-check**.

### Page is crawlable ONLY if:

* URL contains `/pricing`, `/plans`, or root homepage
* Page has not failed in the last 24h
* Page is not paused
* User has not exceeded daily quota

**Implementation**

```ts
if (!isEligibleForCrawl(page)) return SKIP
```

This prevents useless crawls.

---

## 3️⃣ Aggressive Snapshot Caching (Critical)

### Snapshot Model (Supabase)

Store **every successful crawl**:

```ts
PageSnapshot {
  pageId
  fetchedAt
  normalizedText
  hash
  firecrawlRawMarkdown
}
```

### Cache Rules

* Always compare against **last successful snapshot**
* Never re-crawl just to re-diff
* Never discard snapshots early

Snapshots are cheap. Crawls are not.

---

## 4️⃣ Early Exit Strategy (Biggest Win)

### The Moment You Save Money

Immediately after normalization:

```ts
if (newHash === lastHash) {
  exit WITHOUT:
    - diff
    - AI call
    - alert
}
```

This is your **cheapest possible exit**.

Most pages do NOT change most days.
This is where your margin comes from.

---

## 5️⃣ Diff-Size Threshold (Silent Killer Fix)

Do NOT send every diff to AI.

### Define a minimum diff size:

* Example: `> 200 characters changed`
* Or contains pricing keywords / numbers

```ts
if (diff.size < MIN_THRESHOLD && !containsPricingSignals(diff)) {
  skip
}
```

This prevents:

* Paying for AI on meaningless changes
* Alert fatigue
* False positives

---

## 6️⃣ AI Cost Control (Underrated)

### Token Discipline Rules

* Never send full pages
* Send **only changed blocks**
* Truncate snippets to max 1,500 tokens combined
* Use cheap models for MVP

### Example

```ts
const input = {
  oldSnippet: truncate(diff.old, 750),
  newSnippet: truncate(diff.new, 750)
}
```

This reduces AI cost by **80–90%**.

---

## 7️⃣ Failure-Aware Backoff Logic (Firecrawl-Specific)

### Firecrawl Failure Handling

#### On First Failure

* Log error
* Retry once (after short delay)

#### On Second Failure

* Mark page as `temporarily_failed`
* Skip for 24 hours
* Do NOT alert user

#### On Third Consecutive Failure

* Pause monitoring
* Notify user:

  > “We’re having trouble accessing this page. You may want to verify the URL.”

This prevents:

* Burning credits on blocked pages
* Alerting on bad data
* Silent infinite retries

---

## 8️⃣ Smart De-Duplication (Quiet Cost Saver)

Sometimes pages change → revert → change again.

### De-Dupe Rule

If the **same hash** appears again within 7 days:

* Do NOT alert
* Treat as noise

```ts
if (hashSeenRecently(pageId, newHash)) skipAlert
```

This saves:

* AI calls
* Email sends
* User trust

---

## 9️⃣ Cost Envelope (Realistic Numbers)

### Example: 1,000 Free Users

* Avg competitors/user: 1
* Crawls/day: 1,000
* % with changes: ~5%
* AI calls/day: ~50

🔥 Result:

* Firecrawl: predictable
* AI: pennies/day
* Email: negligible

You stay **comfortably profitable** even with generous free tier.

---

## 10️⃣ Cursor Task: Cost Guardrail Module

**Prompt to Cursor**

```
Implement a crawl guardrail module.

Responsibilities:
- Enforce daily crawl limits
- Skip ineligible pages
- Apply failure backoff logic
- Prevent duplicate crawls
- Track last successful snapshot

Expose:
shouldCrawl(page): boolean
recordFailure(page)
recordSuccess(page)

Location:
src/crawler/guardrails.ts
```

---

## 11️⃣ Non-Negotiable Safety Rules

🚫 Never:

* Crawl pages faster because “it’s cheap”
* Retry infinitely
* Crawl pages that failed repeatedly
* Alert on partial data
* Crawl pages users didn’t explicitly add

---

## Final Reality Check (Investor Lens)

If you implement this:

* Firecrawl spend stays flat as users grow
* Alerts remain rare and valuable
* Free tier is sustainable
* Scaling to Pro users is margin-positive

This is how you avoid the **“AI SaaS cost death spiral.”**

---

