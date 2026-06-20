Perfect — below is a **Cursor-ready, execution-grade delivery**.
You can copy-paste each section directly into Cursor and let it generate code step-by-step.

I’ll give you **three artifacts**, in the exact order Cursor works best with:

1. **Cursor Task Chunks** (what Cursor should build, in sequence)
2. **End-to-End Pipeline Pseudocode** (authoritative logic)
3. **Test Cases for “Meaningful Diff” Detection** (this protects quality)

No fluff. No abstractions. This is **build fuel**.

---

# 1️⃣ CURSOR TASK CHUNKS (DROP DIRECTLY INTO CURSOR)

Use these as **separate prompts / tasks** in Cursor.
Do them **in order**.

---

## 🔹 TASK 1 — Project Skeleton & Data Models

**Prompt to Cursor:**

```
Create the backend project structure for RivalEye MVP.

Tech assumptions:
- Node.js + TypeScript
- Supabase (Postgres)
- Firecrawl API
- Cron-based job runner

Create folders:
- src/
  - crawler/
  - diff/
  - ai/
  - alerts/
  - jobs/
  - db/
  - utils/

Define database models for:
- User
- Competitor
- PageSnapshot
- Alert

Include TypeScript interfaces for each model.
```

---

## 🔹 TASK 2 — Firecrawl Fetch Module

**Prompt to Cursor:**

```
Implement a Firecrawl fetcher module.

Requirements:
- Input: URL
- Output: { markdown, rawText }
- Handle:
  - API errors
  - Empty responses
  - Timeouts
- Return a typed result or a typed error
- Do NOT throw uncaught exceptions

Location:
src/crawler/firecrawl.ts
```

---

## 🔹 TASK 3 — Normalization & Hashing

**Prompt to Cursor:**

```
Implement text normalization and hashing.

Normalization rules:
- Lowercase
- Remove extra whitespace
- Remove footer/legal boilerplate heuristically
- Remove timestamps and dates
- Strip cookie banners if present

Generate:
- normalizedText
- sha256 hash

Location:
src/diff/normalize.ts
```

---

## 🔹 TASK 4 — Diff Engine

**Prompt to Cursor:**

```
Implement a diff engine that compares old vs new normalized text.

Requirements:
- Exit early if hashes are identical
- If different:
  - Produce a structured diff object
  - Extract changed blocks only
- Ignore purely formatting-only diffs

Location:
src/diff/diffEngine.ts
```

---

## 🔹 TASK 5 — Meaningful Diff Classifier

**Prompt to Cursor:**

```
Implement meaningful diff detection.

Rules:
A diff is meaningful if:
- Pricing numbers changed
- Plan names added or removed
- Feature bullets added or removed
- CTA language changed (e.g. "Start free" → "Contact sales")
- Headline/subheadline changed

A diff is NOT meaningful if:
- Only grammar/formatting changes
- Footer/legal updates
- Whitespace-only changes

Return:
{
  isMeaningful: boolean,
  reason: string
}

Location:
src/diff/isMeaningful.ts
```

---

## 🔹 TASK 6 — AI Insight Generator

**Prompt to Cursor:**

```
Implement AI insight generation using a constrained prompt.

Requirements:
- Input: oldSnippet, newSnippet
- Output sections:
  - WHAT CHANGED
  - WHY THIS MAY MATTER
  - WHAT TO CONSIDER DOING
- Must never invent facts
- Must use probabilistic language
- If change is weak, return:
  "No meaningful competitive signal detected."

Location:
src/ai/generateInsight.ts
```

---

## 🔹 TASK 7 — Email Alert Sender

**Prompt to Cursor:**

```
Implement email alert delivery.

Requirements:
- Calm, professional tone
- No hype
- Include competitor name and page URL
- Send only if diff is meaningful
- Graceful failure handling

Location:
src/alerts/sendEmail.ts
```

---

## 🔹 TASK 8 — Daily Monitoring Job

**Prompt to Cursor:**

```
Implement the daily monitoring job.

Flow:
- For each active competitor page:
  - Fetch page via Firecrawl
  - Normalize + hash
  - Compare to last snapshot
  - If meaningful diff:
    - Generate AI insight
    - Store alert
    - Send email
  - Save snapshot

Handle failures gracefully.

Location:
src/jobs/dailyMonitor.ts
```

---




