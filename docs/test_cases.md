# 3️⃣ TEST CASES — “MEANINGFUL DIFF” DETECTION

These are **non-negotiable**.
If these pass, alert quality stays high.

---

## ✅ TEST CASE 1 — Pricing Change (MEANINGFUL)

**Old**

```
Pro Plan — $99/month
```

**New**

```
Pro Plan — $129/month
```

**Expected**

```json
{
  "isMeaningful": true,
  "reason": "Pricing value changed"
}
```

---

## ✅ TEST CASE 2 — New Plan Added (MEANINGFUL)

**Old**

```
Free
Pro
```

**New**

```
Free
Pro
Enterprise
```

**Expected**

```json
{
  "isMeaningful": true,
  "reason": "Plan tier added"
}
```

---

## ✅ TEST CASE 3 — CTA Change (MEANINGFUL)

**Old**

```
Start your free trial
```

**New**

```
Contact sales
```

**Expected**

```json
{
  "isMeaningful": true,
  "reason": "Call-to-action changed"
}
```

---

## ❌ TEST CASE 4 — Grammar Fix (NOT MEANINGFUL)

**Old**

```
Best tool for startup founders
```

**New**

```
Best tool for startups founders
```

**Expected**

```json
{
  "isMeaningful": false,
  "reason": "Minor copy edit"
}
```

---

## ❌ TEST CASE 5 — Footer Update (NOT MEANINGFUL)

**Old**

```
© 2023 Company Inc.
```

**New**

```
© 2024 Company Inc.
```

**Expected**

```json
{
  "isMeaningful": false,
  "reason": "Footer/legal update"
}
```

---

## ❌ TEST CASE 6 — Formatting Change (NOT MEANINGFUL)

**Old**

```
Pro Plan
$99 / month
```

**New**

```
Pro Plan — $99/month
```

**Expected**

```json
{
  "isMeaningful": false,
  "reason": "Formatting-only change"
}
```

---

## ⚠️ TEST CASE 7 — Ambiguous Copy (SAFE FAIL)

**Old**

```
Simple pricing for teams
```

**New**

```
Flexible pricing for teams
```

**Expected**

```json
{
  "isMeaningful": false,
  "reason": "Ambiguous positioning change"
}
```

**Rule:**
If unsure → **do not alert**

---

# FINAL EXECUTION NOTE (IMPORTANT)

If you follow this exactly:

* Alerts will feel **rare and valuable**
* AI will feel **honest, not hype**
* Users will trust the product
* Monetization becomes natural

This is how serious tools are built.

---


