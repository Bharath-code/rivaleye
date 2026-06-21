# Abuse Detection Heuristics (Simple, Effective)

Abuse isn’t hackers.
It’s **over-enthusiastic or misconfigured users**.

Your goal:
👉 **Detect patterns, not intentions**

---

## Abuse Category 1 — Crawl Spammers

### Signal

* Manual checks used immediately after reset
* Manual checks every day at same hour
* Manual checks > scheduled checks

### Heuristic

```ts
if (
  manualChecksToday >= 1 &&
  manualChecksLast3Days == max
) flag("manual_spam")
```

### Response

* Soft block manual checks
* Message:

  > “Manual checks are temporarily limited to protect system reliability.”

No accusation. No drama.

---

## Abuse Category 2 — Page Hoarders (Pro)

### Signal

* > 20 pages added within 24 hours
* Many pages never alert
* Crawls spike with no value

### Heuristic

```ts
if (
  activePages > 20 &&
  alertRate < 1%
) flag("low_signal_hoarding")
```

### Response

* Soft cap pages
* Message:

  > “We noticed many low-signal pages. Consider focusing on pricing or key pages.”

---

## Abuse Category 3 — Volatile Pages

### Signal

* Page changes every crawl
* Diffs mostly formatting
* Never meaningful

### Heuristic

```ts
if (
  changeFrequencyHigh &&
  meaningfulRate < 2%
) flag("volatile_page")
```

### Response

* Auto-downgrade crawl frequency
* Mark page as “low-signal”
* No alerts sent

This **saves money silently**.

---

## Abuse Category 4 — Failure Loops

### Signal

* Firecrawl fails repeatedly
* Same page retries daily

### Heuristic

```ts
if (
  consecutiveFailures >= 3
) pausePage()
```

### Response

* Pause page
* Notify user once
* Never retry until user acts

---

## Abuse Category 5 — Global Anomalies (Kill Switch)

### Signal

* Crawls spike unexpectedly
* AI calls exceed expected ratio

### Heuristic

```ts
if (dailyCrawls > expected * 1.5) {
  triggerGlobalThrottle()
}
```

### Response

* Pause new crawls
* Alert admin
* Resume after review

This protects you from **bugs**, not users.

---

# Abuse Handling Philosophy (Important)

Never say:
❌ “You violated limits”
❌ “Abuse detected”

Always say:
✅ “We’ve temporarily limited this to keep things reliable.”

Users accept **reliability framing**.

---

# Final Investor-Grade Conclusion

With:

* Per-user quotas
* Implicit crawl pricing
* Hash exits
* Meaningful diff filters
* Abuse heuristics
* Kill switch

👉 **Your cost curve bends downward while revenue climbs.**

That’s exactly what serious investors look for.

---

## If you want next, I can:

* Turn all heuristics into **TypeScript middleware**
* Model **when to introduce a $49 tier**
* Design **enterprise safety rails**
* Build **admin dashboards for cost visibility**

Say the word — you’re building this the right way.
