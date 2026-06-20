Excellent. Below is a **single, clean PRD file** you can drop directly into **Cursor / any AI IDE** and start vibe-coding from.
It is **implementation-aware**, ruthless, and scoped exactly to the **Firecrawl → diff → AI** MVP we designed.

---

# 📄 PRODUCT REQUIREMENTS DOCUMENT (PRD)

## Product Name: **RivalEye**

### Version: MVP v0.1 (2-Week Build)

### Owner: Founder

### Target: Solo dev + AI IDE (Cursor)

---

## 1. Problem Statement

### The Problem We Are Solving

Founders and marketers are **blind to meaningful competitor changes** until it’s too late.

Current options fail because:

* Website monitoring tools tell *what changed*, not *what it means*
* Enterprise CI tools are bloated and expensive
* Manual checking is unreliable and time-wasting
* Alert noise causes important changes to be ignored

### The Core Insight

Users don’t want *more alerts*.
They want **judgment**.

> “Is this important — and what should I consider doing?”

---

## 2. Product Vision (MVP)

**RivalEye** monitors a competitor’s public page (pricing or homepage), detects *meaningful* changes, and sends an email explaining:

1. What changed (fact)
2. Why it may matter (interpretation)
3. What the user might consider doing (action framing)

The MVP is successful if:

* A user receives **one genuinely useful alert**
* The alert feels calm, accurate, and trustworthy
* The user replies: *“This is actually helpful”*

---

## 3. Target User (ICP)

### Primary User

* Indie SaaS founder (1–10 people)
* Tracks 1–2 direct competitors
* Cares deeply about pricing, positioning, and feature changes

### Secondary

* Growth / marketing lead at small SaaS
* Agency tracking competitors for clients (future)

---

## 4. Non-Goals (Explicitly Out of Scope)

The following are **NOT** part of MVP:

* Social media monitoring
* Job postings
* Teams / collaboration
* Slack integration
* Real-time monitoring
* Browser automation (BrowserUse)
* Analytics dashboards
* Enterprise features

If it doesn’t help deliver **one great alert**, it’s out.

---

## 5. User Journey (End-to-End)

### Step 1: Landing → Signup

* User lands on homepage
* Enters email (magic link auth)

### Step 2: Add Competitor

* User inputs:

  * Competitor name
  * URL (pricing page preferred)
* App immediately runs first crawl

### Step 3: Monitoring

* Page checked daily (cron)
* Manual “Check now” allowed once/day

### Step 4: Change Detected

* System determines if change is **meaningful**
* If yes → generate AI insight

### Step 5: Alert Delivered

* User receives email with:

  * What changed
  * Why it may matter
  * What to consider doing

This email **is the product**.

---

## 6. User Stories (MVP)

### Core

* As a user, I want to add a competitor URL so I can monitor it
* As a user, I want to know when pricing or positioning changes
* As a user, I want the alert to explain *why* the change matters
* As a user, I want alerts only when something meaningful happens

### Trust

* As a user, I don’t want exaggerated or fake predictions
* As a user, I want the AI to say “no meaningful change” when appropriate

---

## 7. System Architecture (MVP)

### High-Level Flow

```
URL
 → Firecrawl
   → Clean Markdown/Text
     → Normalize
       → Diff vs previous
         → Meaningfulness Filter
           → AI Insight Generator
             → Email Alert
```

### Components

* **Crawler:** Firecrawl API
* **Storage:** Supabase (snapshots, diffs, alerts)
* **Scheduler:** Cron (daily)
* **AI:** LLM via prompt (bounded reasoning)
* **Delivery:** Email (Resend / Postmark)

---

## 8. Firecrawl → Diff → AI Pipeline (Exact Design)

### 8.1 Firecrawl Usage

**Input**

* URL (public page only)

**Output**

* Markdown
* Extracted text

**Rules**

* Only crawl:

  * `/pricing`
  * `/plans`
  * homepage (optional)
* Cache last successful crawl
* Respect robots.txt (Firecrawl default)

---

### 8.2 Normalization Step

Before diffing:

* Remove:

  * Whitespace noise
  * Timestamps
  * Cookie banners
  * Footer boilerplate
* Convert text to lowercase
* Collapse repeated spaces

Store:

```json
{
  "url": "...",
  "markdown": "...",
  "normalized_text": "...",
  "hash": "sha256"
}
```

---

### 8.3 Diff Strategy

**Primary check**

* Compare SHA-256 hash of normalized text

If hash unchanged → exit early.

If changed:

* Compute text diff (line or block based)
* Extract only changed sections

---

## 9. Meaningful Diff Detection (Critical)

### Definition of “Meaningful”

A change is meaningful **only if it affects user decision-making**.

### Meaningful Change Heuristics (MVP)

A diff is **meaningful** if ANY are true:

* Price values changed (`$`, `€`, numbers near “per month/year”)
* Plan names added/removed
* Feature bullets added/removed
* CTA language changed (“Start free” → “Contact sales”)
* Positioning headline/subheadline changed

A diff is **NOT meaningful** if:

* Only formatting changes
* Legal/footer updates
* Grammar/copy polish
* Minor word swaps with same meaning

### Simple Implementation Rule

* If diff length < threshold → ignore
* If diff contains pricing keywords or numbers → meaningful
* Else → low-signal → ignore

---

## 10. AI Insight Generation (Anti-Hallucination)

### AI Input

* Old text snippet (changed section only)
* New text snippet (changed section only)

### AI Rules

* Never invent facts
* Separate observation from interpretation
* Use probabilistic language only
* If unclear → say so

### AI Output Structure

```
WHAT CHANGED
WHY THIS MAY MATTER
WHAT TO CONSIDER DOING
```

### If change is weak:

> “No meaningful competitive signal detected.”

---

## 11. Alert Delivery (Email)

### Subject

* “Competitor X changed pricing — here’s what it may mean”

### Body Sections

1. What changed (fact)
2. Why it may matter (interpretation)
3. What to consider doing (actions)
4. Soft upgrade CTA (if free limit reached)

No hype. No urgency. No emojis.

---

## 12. Fallback Logic (Firecrawl Failure Handling)

### Scenario 1: Firecrawl Timeout / Error

* Retry once
* If still failing:

  * Use last cached version
  * Log error
  * Do NOT alert user

### Scenario 2: Empty or Blocked Content

* Mark page as “temporarily unavailable”
* Skip diff
* Retry next scheduled run

### Scenario 3: Repeated Failures (3+)

* Pause monitoring
* Notify user:

  > “We’re having trouble accessing this page. You may want to check the URL.”

### Never:

* Send alerts based on partial or broken data
* Guess changes

---

## 13. Free vs Pro (MVP Enforcement)

### Free (Forever)

* 1 competitor
* 1 page
* Daily checks
* Descriptive alerts
* Last 5 alerts

### Pro (Later)

* Unlimited competitors
* Faster checks
* Deeper interpretation
* History
* Filtering

**Never gate seeing that a change occurred.**

---

## 14. Success Metrics (MVP)

Primary:

* User replies to alert email
* “This was useful” feedback

Secondary:

* Alert open rate
* Second manual check triggered
* Attempt to add second competitor

Ignore:

* DAUs
* Vanity analytics
* Conversion early on

---

## 15. Risks & Mitigations

| Risk             | Mitigation                              |
| ---------------- | --------------------------------------- |
| AI hallucination | Constrained prompt + under-claiming     |
| Alert fatigue    | Meaningful diff filter                  |
| Scraping failure | Firecrawl + caching + graceful fallback |
| Overbuilding     | Strict MVP scope                        |

---

## 16. MVP Definition of Done

The MVP is complete when:

* A real competitor pricing change triggers
* A clean, calm, accurate email is sent
* A user says: **“This helped me think.”**

Anything beyond that is iteration.

---


