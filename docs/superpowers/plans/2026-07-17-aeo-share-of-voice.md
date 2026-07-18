# AEO Share-of-Voice (PAR-1) + Free AI-Visibility Checker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**GTM companion:** `docs/GTM_POSITIONING_PLAYBOOK.md` — positioning, first-10-customers, launch sequence, landing copy, and brand direction that this plan's features unlock.

**Goal:** Make RivalEye answer "how visible am *I* in AI answers vs my competitors" (PAR-1), expose it on the dashboard, capture the user's brand at onboarding, ship a free pre-signup AI-visibility checker as the marketing wedge, and add citation-source tracking (PAR-2).

**Architecture:** The AEO scan pipeline (`src/lib/aeo/scan.ts`) already queries 5 models and parses *competitor* brand mentions via `isBrandMentioned()`. We reuse that exact parser against the **user's own brand** on the same responses (zero extra LLM cost), persist two new columns on `aeo_visibility`, and surface "your share vs their share" through the existing summary → aggregate → dashboard chain. The free checker is a new public route modeled on `/api/public/teardown` (per-IP rate limit, no auth) that runs a mini scan (3 queries × 2 cheapest models) with a 24h per-domain cache so repeat checks cost nothing.

**Tech Stack:** Next.js 16 App Router, Supabase (service-role client — every tenant query MUST filter `user_id`), Zod at the edge, Vitest, existing AEO providers (`queryModel`), pino logging.

## Global Constraints

- `npm run verify` (typecheck:ci + test:run + build) must be green at the end of every task. Baseline: 586+ tests passing.
- No new npm dependencies.
- Mutating routes: `assertSameOrigin(request)` first, then `getUserId()`, then rate limit (project convention).
- Every tenant Supabase query filters `.eq("user_id", userId)` — the CI guard `src/app/api/__tests__/tenant-scoping.guard.test.ts` fails otherwise; public routes must be allowlisted there with a justification.
- No `console.log` in routes; use `withRequestId`/`withUser` pino loggers (public routes may follow teardown's `console.warn`/`console.error` precedent).
- No hardcoded prices anywhere (`PLAN_PRICING` is the single source).
- Tests colocated in `__tests__/*.test.ts` next to the code.
- Comments only for non-obvious *why*; deliberate simplifications marked `// ponytail: ...`.
- Commit after each task (small, descriptive, `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`).

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260717_own_brand_sov.sql` | Create | `own_mentioned`/`own_position` columns on `aeo_visibility`; `public_aeo_checks` cache table |
| `src/lib/types.ts` | Modify | `UserSettings` gains `brand_name`/`brand_url` |
| `src/lib/validation/schemas.ts` | Modify | extend `updateSettingsSchema`; add `aeoCheckSchema` |
| `src/app/api/settings/route.ts` | Modify | persist brand fields |
| `src/lib/aeo/ownShare.ts` | Create | pure `computeOwnShare()` |
| `src/lib/aeo/__tests__/ownShare.test.ts` | Create | tests for `computeOwnShare` |
| `src/lib/aeo/scan.ts` | Modify | own-brand mention capture + own share in `VisibilitySummary` |
| `src/lib/aeo/aggregateVisibility.ts` | Modify | blended own share across competitors |
| `src/lib/aeo/__tests__/aggregateVisibility.test.ts` | Modify | own-share aggregation tests |
| `src/app/api/aeo/summary/route.ts` | Modify | return `brand_set` |
| `src/components/dashboard/DashboardAEOSummary.tsx` | Modify | "Your share" hero + set-brand CTA |
| `src/components/onboarding/OnboardingWizard.tsx` | Modify | capture user's own brand in step 2 |
| `src/lib/rateLimit.ts` | Modify | `aeoCheck` limit (3/day/IP) |
| `src/app/api/public/aeo-check/route.ts` | Create | free public visibility checker (cached) |
| `src/app/api/__tests__/tenant-scoping.guard.test.ts` | Modify | allowlist the two new routes |
| `src/components/marketing/AIVisibilityChecker.tsx` | Create | landing-page checker widget |
| `src/app/page.tsx` | Modify | mount checker in the AEO scorecard section |
| `src/lib/aeo/citations.ts` | Create | pure `topCitedDomains()` (PAR-2) |
| `src/lib/aeo/__tests__/citations.test.ts` | Create | tests for `topCitedDomains` |
| `src/app/api/aeo/citations/route.ts` | Create | per-competitor cited-domain ranking |
| `src/components/dashboard/AEOVisibilityCard.tsx` | Modify | render top citations list |

---

### Task 1: Schema + brand settings plumbing

**Files:**
- Create: `supabase/migrations/20260717_own_brand_sov.sql`
- Modify: `src/lib/types.ts:5-15` (UserSettings + defaults)
- Modify: `src/lib/validation/schemas.ts:86-109` (updateSettingsSchema)
- Modify: `src/app/api/settings/route.ts:84-107` (PATCH field handling)

**Interfaces:**
- Consumes: existing `UserSettings`, `DEFAULT_USER_SETTINGS`, `updateSettingsSchema`, settings PATCH route.
- Produces: `UserSettings.brand_name: string | null`, `UserSettings.brand_url: string | null` — read by Task 2 (scan) and Task 3 (summary route). SQL columns `aeo_visibility.own_mentioned BOOLEAN`, `aeo_visibility.own_position INTEGER`; table `public_aeo_checks(cache_key, result, created_at)` — used by Tasks 2 and 5.

**Acceptance criteria:**
- [ ] Migration file exists and is idempotent (`IF NOT EXISTS` everywhere).
- [ ] `PATCH /api/settings` with `{"brand_name":"Acme","brand_url":"https://acme.com"}` persists both; empty string clears to null.
- [ ] Invalid `brand_url` (not a URL) returns 400.
- [ ] `npm run verify` green.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260717_own_brand_sov.sql
-- PAR-1: own-brand share-of-voice. The user's own brand mention is checked
-- against the SAME model responses as the competitor's (no extra LLM cost).
-- own_mentioned is NULL when the user had no brand configured at scan time.
ALTER TABLE aeo_visibility
    ADD COLUMN IF NOT EXISTS own_mentioned BOOLEAN,
    ADD COLUMN IF NOT EXISTS own_position INTEGER;

-- Free public AI-visibility checker: 24h per-(domain,brand) result cache so
-- repeat checks (and abuse retries) cost zero LLM spend.
CREATE TABLE IF NOT EXISTS public_aeo_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key TEXT NOT NULL,
    result JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_aeo_checks_key
    ON public_aeo_checks(cache_key, created_at DESC);
```

Note: the user's brand itself lives in `users.settings` JSONB (no column needed — Task 1 steps 2–4 wire it through the existing settings plumbing). `// ponytail: brand in settings JSONB, promote to columns if we ever need to query users by brand`.

- [ ] **Step 2: Extend `UserSettings` in `src/lib/types.ts`**

Replace lines 5–15 with:

```ts
export interface UserSettings {
    email_enabled: boolean;
    digest_frequency: "instant" | "daily" | "weekly";
    slack_webhook_url: string | null;
    brand_name: string | null;
    brand_url: string | null;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
    email_enabled: true,
    digest_frequency: "instant",
    slack_webhook_url: null,
    brand_name: null,
    brand_url: null,
};
```

- [ ] **Step 3: Extend `updateSettingsSchema` in `src/lib/validation/schemas.ts`**

Inside the existing `.object({ ... })` (after `slack_webhook_url`), add:

```ts
        brand_name: z
            .union([z.literal(""), z.string().trim().min(2).max(100), z.null()])
            .optional(),
        brand_url: z
            .union([z.literal(""), z.string().url().max(2048), z.null()])
            .optional(),
```

- [ ] **Step 4: Handle the new fields in `src/app/api/settings/route.ts` PATCH**

After the `slack_webhook_url` block (line ~107), add:

```ts
        if (parsed.data.brand_name !== undefined) {
            updates.brand_name =
                parsed.data.brand_name === "" ? null : parsed.data.brand_name;
        }
        if (parsed.data.brand_url !== undefined) {
            updates.brand_url =
                parsed.data.brand_url === "" ? null : parsed.data.brand_url;
        }
```

(No GET changes needed — the `{...DEFAULT_USER_SETTINGS, ...user.settings}` merge already returns the new keys.)

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run test:run`
Expected: clean typecheck, all tests pass (no behavior change yet).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260717_own_brand_sov.sql src/lib/types.ts src/lib/validation/schemas.ts src/app/api/settings/route.ts
git commit -m "feat(aeo): PAR-1 schema — own-brand columns, checker cache, brand settings"
```

---

### Task 2: Own-brand mention capture in the scan pipeline

**Files:**
- Create: `src/lib/aeo/ownShare.ts`
- Create: `src/lib/aeo/__tests__/ownShare.test.ts`
- Modify: `src/lib/aeo/scan.ts` (runAEOScan rows/loop, ScanResult, VisibilitySummary, getVisibilitySummary)

**Interfaces:**
- Consumes: `isBrandMentioned(text, citations, brand, brandUrl?)` from `./parser` (already imported in scan.ts); `UserSettings` brand fields from Task 1.
- Produces:
  - `computeOwnShare(rows: Array<{ own_mentioned: boolean | null }>): OwnShare | null` where `interface OwnShare { total: number; mentions: number; visibility_pct: number }` — exported from `src/lib/aeo/ownShare.ts`, consumed by Task 3.
  - `ScanResult` gains `own_mentions: number | null` and `own_visibility_pct: number | null` (null = brand not configured).
  - `VisibilitySummary` gains `own: OwnShare | null`.

**Acceptance criteria:**
- [ ] A scan for a user with `brand_name` set writes `own_mentioned`/`own_position` on every persisted row; without a brand both stay null.
- [ ] `computeOwnShare` returns null when no row has non-null `own_mentioned` (pre-migration history stays "no data", never 0%).
- [ ] `getVisibilitySummary(...).own.visibility_pct` reflects own-mention rate over the window.
- [ ] Unit tests cover: null on empty, null on all-null, correct pct on mixed rows.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/aeo/__tests__/ownShare.test.ts
import { describe, it, expect } from "vitest";
import { computeOwnShare } from "../ownShare";

describe("computeOwnShare", () => {
    it("returns null when there are no rows", () => {
        expect(computeOwnShare([])).toBeNull();
    });

    it("returns null when no row has own-brand data (pre-PAR-1 history)", () => {
        expect(
            computeOwnShare([{ own_mentioned: null }, { own_mentioned: null }])
        ).toBeNull();
    });

    it("computes share over rows that have own-brand data only", () => {
        const rows = [
            { own_mentioned: true },
            { own_mentioned: false },
            { own_mentioned: true },
            { own_mentioned: null }, // scanned before brand was set — excluded
        ];
        expect(computeOwnShare(rows)).toEqual({
            total: 3,
            mentions: 2,
            visibility_pct: 66.7,
        });
    });

    it("rounds to one decimal", () => {
        const rows = [
            { own_mentioned: true },
            { own_mentioned: false },
            { own_mentioned: false },
        ];
        expect(computeOwnShare(rows)!.visibility_pct).toBe(33.3);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/aeo/__tests__/ownShare.test.ts`
Expected: FAIL — `Cannot find module '../ownShare'`.

- [ ] **Step 3: Implement `src/lib/aeo/ownShare.ts`**

```ts
export interface OwnShare {
    total: number;
    mentions: number;
    visibility_pct: number;
}

/**
 * Own-brand share over scan rows. Rows with own_mentioned === null were
 * scanned before the user configured a brand — excluded, not counted as 0,
 * so history from before PAR-1 can't drag the score down.
 */
export function computeOwnShare(
    rows: Array<{ own_mentioned: boolean | null }>
): OwnShare | null {
    const withData = rows.filter((r) => r.own_mentioned !== null);
    if (withData.length === 0) return null;
    const mentions = withData.filter((r) => r.own_mentioned).length;
    return {
        total: withData.length,
        mentions,
        visibility_pct:
            Math.round((mentions / withData.length) * 1000) / 10,
    };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/aeo/__tests__/ownShare.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire own-brand capture into `runAEOScan` in `src/lib/aeo/scan.ts`**

5a. Add imports at the top:

```ts
import { computeOwnShare, type OwnShare } from "./ownShare";
```

5b. Extend `ScanResult` (lines 23–33) with:

```ts
    own_mentions: number | null;
    own_visibility_pct: number | null;
```

5c. After the competitor load (line ~68, after the `aeo_enabled` check), load the user's brand:

```ts
    const { data: userRow } = await supabase
        .from("users")
        .select("settings")
        .eq("id", userId)
        .single();
    const brandName: string | null = userRow?.settings?.brand_name ?? null;
    const brandUrl: string | null = userRow?.settings?.brand_url ?? null;
```

5d. In the `rows` array element type (lines 152–164), add:

```ts
        own_mentioned: boolean | null;
        own_position: number | null;
```

5e. In the parse loop (lines 170–200), after the competitor `check`, add the own-brand check and counter (declare `let ownMentions = 0;` next to `totalMentions`):

```ts
        const own = brandName
            ? isBrandMentioned(
                  r.response_text,
                  r.citations,
                  brandName,
                  brandUrl ?? undefined
              )
            : null;
        if (own?.mentioned) ownMentions++;
```

and extend the `rows.push({...})` object with:

```ts
            own_mentioned: own ? own.mentioned : null,
            own_position: own?.position ?? null,
```

5f. Extend the return value (lines 245–255) with:

```ts
        own_mentions: brandName ? ownMentions : null,
        own_visibility_pct:
            brandName && rows.length > 0
                ? Math.round((ownMentions / rows.length) * 1000) / 10
                : null,
```

- [ ] **Step 6: Extend `VisibilitySummary` + `getVisibilitySummary`**

6a. Add to the `VisibilitySummary` interface (lines 261–273):

```ts
    own: OwnShare | null;
```

6b. In `getVisibilitySummary`, after the by-model RPC (line ~307), fetch own-share rows with a direct query (the RPCs don't know the new columns; `idx_aeo_user_competitor_time` covers this):

```ts
    const { data: ownRows, error: ownError } = await supabase
        .from("aeo_visibility")
        .select("own_mentioned")
        .eq("user_id", userId)
        .eq("competitor_id", competitorId)
        .gte("scanned_at", since);

    if (ownError) {
        logger.error({ err: ownError }, "AEO own-share query failed");
    }
```

6c. Add to the returned object:

```ts
        own: computeOwnShare(ownRows ?? []),
```

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npm run test:run`
Expected: clean. (Callers of `getVisibilitySummary` get the new field for free; `ScanResult` consumers — `/api/aeo/track`, `src/trigger/aeoMonitor.ts` — only read existing fields, but typecheck will flag any object-literal construction that needs the new keys; add `own_mentions: null, own_visibility_pct: null` there if the compiler asks.)

- [ ] **Step 8: Commit**

```bash
git add src/lib/aeo/ownShare.ts src/lib/aeo/__tests__/ownShare.test.ts src/lib/aeo/scan.ts
git commit -m "feat(aeo): PAR-1 — capture own-brand mentions in scan, own share in summary"
```

---

### Task 3: Blended own share in aggregate + summary API

**Files:**
- Modify: `src/lib/aeo/aggregateVisibility.ts`
- Modify: `src/lib/aeo/__tests__/aggregateVisibility.test.ts`
- Modify: `src/app/api/aeo/summary/route.ts`

**Interfaces:**
- Consumes: `VisibilitySummary.own: OwnShare | null` from Task 2.
- Produces: `AggregateVisibility` gains `own: { total: number; mentions: number; visibility_pct: number } | null` (blended from raw counts, same weighting rule as the competitor blend). Summary API response gains top-level `brand_set: boolean`. Both consumed by Task 4's dashboard UI.

**Acceptance criteria:**
- [ ] Blended `own.visibility_pct` computed from raw mention/total counts across competitors (not an average of percentages) — test proves a 10-query competitor outweighs a 2-query one.
- [ ] `own` is null when no competitor summary carries own data.
- [ ] `GET /api/aeo/summary` returns `brand_set: true/false` from the user's settings.
- [ ] Existing aggregate tests still pass.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/aeo/__tests__/aggregateVisibility.test.ts` (match its existing describe/import style; the summary factory below must now include `own`):

```ts
describe("own share blending", () => {
    const summary = (
        total: number,
        mentions: number,
        own: { total: number; mentions: number; visibility_pct: number } | null
    ) => ({
        total,
        mentions,
        visibility_pct: total ? (mentions / total) * 100 : 0,
        avg_position: null,
        by_model: [],
        own,
    });

    it("is null when no summary has own data", () => {
        const out = aggregateVisibility([
            { id: "a", name: "A", summary: summary(5, 2, null) },
        ]);
        expect(out.own).toBeNull();
    });

    it("blends own share from raw counts, weighting by query volume", () => {
        const out = aggregateVisibility([
            {
                id: "a",
                name: "A",
                summary: summary(10, 5, { total: 10, mentions: 1, visibility_pct: 10 }),
            },
            {
                id: "b",
                name: "B",
                summary: summary(2, 2, { total: 2, mentions: 2, visibility_pct: 100 }),
            },
        ]);
        // raw blend: 3/12 = 25%, NOT avg(10,100)=55%
        expect(out.own).toEqual({ total: 12, mentions: 3, visibility_pct: 25 });
    });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run src/lib/aeo/__tests__/aggregateVisibility.test.ts`
Expected: existing tests may also fail to typecheck (summary objects now need `own`) — fix fixtures by adding `own: null` to them; the two new tests must FAIL on missing `out.own`.

- [ ] **Step 3: Implement in `src/lib/aeo/aggregateVisibility.ts`**

3a. Add to the `AggregateVisibility` interface:

```ts
    /** Blended own-brand share across all scanned competitors; null when the
     *  user has no brand configured / no own-brand data in the window. */
    own: { total: number; mentions: number; visibility_pct: number } | null;
```

3b. In `aggregateVisibility`, accumulate raw own counts and return the blend:

```ts
    let ownTotal = 0;
    let ownMentions = 0;
    for (const { summary } of rows) {
        if (summary?.own) {
            ownTotal += summary.own.total;
            ownMentions += summary.own.mentions;
        }
    }
```

and in the returned object:

```ts
        own:
            ownTotal > 0
                ? {
                      total: ownTotal,
                      mentions: ownMentions,
                      visibility_pct: round1((ownMentions / ownTotal) * 100),
                  }
                : null,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/aeo/__tests__/aggregateVisibility.test.ts`
Expected: PASS, including pre-existing tests.

- [ ] **Step 5: Return `brand_set` from `src/app/api/aeo/summary/route.ts`**

In the handler, change the competitor fetch block to also load the user's settings (one extra cheap query), after `const supabase = createServerClient();`:

```ts
        const { data: userRow } = await supabase
            .from("users")
            .select("settings")
            .eq("id", userId)
            .single();
        const brandSet = Boolean(userRow?.settings?.brand_name);
```

and extend the response JSON:

```ts
            {
                window_days: windowDays,
                brand_set: brandSet,
                ...aggregateVisibility(summaries),
            },
```

- [ ] **Step 6: Verify + commit**

Run: `npm run typecheck && npm run test:run` → clean.

```bash
git add src/lib/aeo/aggregateVisibility.ts src/lib/aeo/__tests__/aggregateVisibility.test.ts src/app/api/aeo/summary/route.ts
git commit -m "feat(aeo): blended own share in aggregate + brand_set on summary API"
```

---

### Task 4: Dashboard "Your share" + onboarding brand capture

**Files:**
- Modify: `src/components/dashboard/DashboardAEOSummary.tsx`
- Modify: `src/components/onboarding/OnboardingWizard.tsx`

**Interfaces:**
- Consumes: summary payload `{ own, brand_set, visibility_pct, ... }` from Task 3; `PATCH /api/settings` accepting `brand_name`/`brand_url` from Task 1.
- Produces: UI only — no new exports.

**Acceptance criteria:**
- [ ] With own data: panel leads with "Your share X%" next to the blended competitor number, visually distinct (emerald = you, muted = them).
- [ ] Brand not set: panel shows a one-line CTA linking to `/dashboard/settings` ("Add your brand to see your share of AI answers"); no broken/empty number.
- [ ] Onboarding step 2 has optional "Your product name" + "Your website" inputs; filling them PATCHes `/api/settings` on submit; leaving them blank does not block onboarding and sends no PATCH.
- [ ] `npm run build` succeeds (client components compile).

- [ ] **Step 1: Extend `DashboardAEOSummary.tsx`**

1a. The `Summary` type (line 21) becomes:

```ts
type Summary = AggregateVisibility & { window_days: number; brand_set: boolean };
```

1b. Replace the left column of `Populated` (the `md:pr-6 md:border-r` div, lines 128–136) with a you-vs-them block:

```tsx
            <div className="md:pr-6 md:border-r border-white/5 space-y-3">
                {data.own ? (
                    <div>
                        <div className="text-4xl font-display font-bold text-emerald-400 leading-none">
                            {data.own.visibility_pct.toFixed(0)}%
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            your share of AI answers
                        </p>
                    </div>
                ) : !data.brand_set ? (
                    <Link
                        href="/dashboard/settings"
                        className="block text-xs text-emerald-400 hover:underline max-w-[180px] leading-relaxed"
                    >
                        Add your brand to see your share of AI answers →
                    </Link>
                ) : (
                    <p className="text-[11px] text-muted-foreground max-w-[180px] leading-relaxed">
                        Your share appears after the next scan.
                    </p>
                )}
                <div>
                    <div className="text-2xl font-display font-bold text-foreground leading-none">
                        {data.visibility_pct.toFixed(0)}%
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed max-w-[180px]">
                        competitors&apos; blended visibility ({scanned.length} scanned)
                    </p>
                </div>
            </div>
```

1c. Also show the CTA in the `EmptyScanned`/`EmptyTracked` paths? No — `// ponytail: CTA only in Populated; empty states already have one job each`.

- [ ] **Step 2: Add brand capture to `OnboardingWizard.tsx` step 2**

2a. Add state next to the existing `url`/`name` state (line ~26):

```ts
    const [brandName, setBrandName] = useState("");
    const [brandUrl, setBrandUrl] = useState("");
```

2b. In `handleSubmit`, before `await onComplete(...)` (line ~53), fire-and-forget the settings PATCH when provided (failure must not block onboarding):

```ts
        if (brandName.trim()) {
            fetch("/api/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    brand_name: brandName.trim(),
                    ...(brandUrl.trim() ? { brand_url: brandUrl.trim() } : {}),
                }),
            }).catch(() => {}); // ponytail: best-effort; settings page is the fallback
        }
```

2c. In the step-2 JSX, after the competitor-name input block (line ~159), add:

```tsx
                                <div className="pt-2 border-t border-white/5 space-y-2">
                                    <Label htmlFor="brand-name">
                                        Your product (optional — unlocks &quot;your share of AI answers&quot;)
                                    </Label>
                                    <Input
                                        id="brand-name"
                                        type="text"
                                        placeholder="Your product name"
                                        value={brandName}
                                        onChange={(e) => setBrandName(e.target.value)}
                                    />
                                    <Input
                                        id="brand-url"
                                        type="url"
                                        placeholder="https://yourproduct.com"
                                        value={brandUrl}
                                        onChange={(e) => setBrandUrl(e.target.value)}
                                    />
                                </div>
```

- [ ] **Step 3: Verify + commit**

Run: `npm run verify` → green (build compiles both client components).

```bash
git add src/components/dashboard/DashboardAEOSummary.tsx src/components/onboarding/OnboardingWizard.tsx
git commit -m "feat(dashboard): your-share-vs-them AEO panel + onboarding brand capture"
```

---

### Task 5: Free public AI-visibility checker API

**Files:**
- Modify: `src/lib/rateLimit.ts:199-200` (add `aeoCheck` next to `teardown`)
- Modify: `src/lib/validation/schemas.ts` (add `aeoCheckSchema` next to `teardownSchema`, line ~56)
- Create: `src/app/api/public/aeo-check/route.ts`
- Modify: `src/app/api/__tests__/tenant-scoping.guard.test.ts` (allowlist)

**Interfaces:**
- Consumes: `queryModel(model, q)` and `ModelName` from `src/lib/aeo/providers`; `isBrandMentioned` from `src/lib/aeo/parser`; `generateDefaultQueries` from `src/lib/aeo/queries`; `checkRateLimit`/`RATE_LIMITS`/`rateLimitHeaders` from `src/lib/rateLimit`; `validateCompetitorUrl` from `src/lib/urlValidator`; `public_aeo_checks` table from Task 1.
- Produces: `POST /api/public/aeo-check` with body `{ brand: string, url: string }` returning `{ brand, url, total, mentions, visibility_pct, results: Array<{ model, query, mentioned, excerpt }> , cached: boolean }`. Consumed by Task 6's landing component.

**Acceptance criteria:**
- [ ] No auth; per-IP rate limit 3 requests / 24h (this endpoint spends real LLM money).
- [ ] Scan is capped at 3 queries × 2 models (gemini + chatgpt = cheapest) — max 6 LLM calls per uncached request.
- [ ] Same (domain, brand) within 24h returns the cached result (`cached: true`) without any LLM call.
- [ ] URL goes through `validateCompetitorUrl` (SSRF guard); invalid → 400.
- [ ] Route is allowlisted in the tenant-scoping guard with a written justification.
- [ ] Response never includes raw full model responses (excerpts ≤ 300 chars only).

- [ ] **Step 1: Add the rate limit**

In `src/lib/rateLimit.ts`, after the `teardown` entry (line 200):

```ts
    /** Free public AEO checker: 3 per 24h per IP — each uncached call costs up to 6 LLM queries */
    aeoCheck: { maxRequests: 3, windowMs: 24 * 60 * 60 * 1000 } as RateLimitConfig,
```

- [ ] **Step 2: Add the schema**

In `src/lib/validation/schemas.ts`, after `teardownSchema` (line ~59):

```ts
export const aeoCheckSchema = z.object({
    brand: z.string().trim().min(2).max(100),
    url: z.string().url().max(2048),
});
export type AeoCheckInput = z.infer<typeof aeoCheckSchema>;
```

- [ ] **Step 3: Write the route**

```ts
// src/app/api/public/aeo-check/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateCompetitorUrl } from "@/lib/urlValidator";
import { checkRateLimit, RATE_LIMITS, rateLimitHeaders } from "@/lib/rateLimit";
import { parseBody, aeoCheckSchema } from "@/lib/validation/schemas";
import { queryModel, type ModelName } from "@/lib/aeo/providers";
import { isBrandMentioned } from "@/lib/aeo/parser";
import { generateDefaultQueries } from "@/lib/aeo/queries";
import { createServerClient } from "@/lib/supabase";

/**
 * POST /api/public/aeo-check
 *
 * Free pre-signup "am I visible in AI answers?" checker — the AEO wedge's
 * activation moment, mirroring /api/public/teardown. No auth; abuse is gated
 * by a strict per-IP limit (3/day) + a 24h per-(domain,brand) result cache,
 * and each uncached run is hard-capped at 3 queries × 2 cheapest models.
 */
const CHECK_MODELS: ModelName[] = ["gemini", "chatgpt"];
const CHECK_QUERY_COUNT = 3;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
    const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";

    const rateCheck = await checkRateLimit(`aeo-check:${ip}`, RATE_LIMITS.aeoCheck);
    if (!rateCheck.allowed) {
        return NextResponse.json(
            { error: "Free check limit reached — sign up for daily tracking." },
            {
                status: 429,
                headers: {
                    "Retry-After": String(Math.ceil(rateCheck.resetMs / 1000)),
                    ...rateLimitHeaders(rateCheck, RATE_LIMITS.aeoCheck),
                },
            }
        );
    }

    const parsed = await parseBody(request, aeoCheckSchema);
    if (parsed.error) return parsed.error;

    const validation = validateCompetitorUrl(parsed.data.url);
    if (!validation.valid || !validation.sanitizedUrl) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const brand = parsed.data.brand;
    const hostname = new URL(validation.sanitizedUrl).hostname.replace(/^www\./, "");
    const cacheKey = `${hostname}::${brand.toLowerCase()}`;
    const supabase = createServerClient();

    const { data: cached } = await supabase
        .from("public_aeo_checks")
        .select("result, created_at")
        .eq("cache_key", cacheKey)
        .gte("created_at", new Date(Date.now() - CACHE_TTL_MS).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (cached?.result) {
        return NextResponse.json({ ...cached.result, cached: true });
    }

    const queries = generateDefaultQueries({
        name: brand,
        url: validation.sanitizedUrl,
    }).slice(0, CHECK_QUERY_COUNT);

    const tasks = queries.flatMap((query) =>
        CHECK_MODELS.map((model) => ({ model, query }))
    );

    const settled = await Promise.allSettled(
        tasks.map(({ model, query }) =>
            queryModel(model, { prompt: query, competitorName: brand })
        )
    );

    let mentions = 0;
    let answered = 0;
    const results: Array<{
        model: ModelName;
        query: string;
        mentioned: boolean;
        excerpt: string | null;
    }> = [];

    for (let i = 0; i < tasks.length; i++) {
        const s = settled[i];
        if (s.status !== "fulfilled" || !s.value) continue;
        answered++;
        const check = isBrandMentioned(
            s.value.response_text,
            s.value.citations,
            brand,
            validation.sanitizedUrl
        );
        if (check.mentioned) mentions++;
        results.push({
            model: tasks[i].model,
            query: tasks[i].query,
            mentioned: check.mentioned,
            excerpt: check.excerpt,
        });
    }

    if (answered === 0) {
        console.error(`[AEOCheck] all model calls failed for ${cacheKey}`);
        return NextResponse.json(
            { error: "AI models are busy right now. Try again in a minute." },
            { status: 502 }
        );
    }

    const result = {
        brand,
        url: validation.sanitizedUrl,
        total: answered,
        mentions,
        visibility_pct: Math.round((mentions / answered) * 1000) / 10,
        results,
    };

    const { error: cacheError } = await supabase
        .from("public_aeo_checks")
        .insert({ cache_key: cacheKey, result });
    if (cacheError) console.error("[AEOCheck] cache insert failed:", cacheError.message);

    return NextResponse.json({ ...result, cached: false });
}
```

- [ ] **Step 4: Allowlist in the tenant-scoping guard**

Run `npx vitest run src/app/api/__tests__/tenant-scoping.guard.test.ts` — it should FAIL naming `public/aeo-check`. Add it to the guard's allowlist (follow the file's existing entry format, e.g. next to `public/teardown`) with the justification:

```ts
    // public/aeo-check: intentionally unauthenticated growth endpoint — no tenant
    // data touched; reads/writes only the anonymous public_aeo_checks cache,
    // gated by per-IP rate limit + 24h cache + 6-call hard cap.
```

Re-run the guard test → PASS.

- [ ] **Step 5: Verify + commit**

Run: `npm run verify` → green.

```bash
git add src/lib/rateLimit.ts src/lib/validation/schemas.ts src/app/api/public/aeo-check/route.ts src/app/api/__tests__/tenant-scoping.guard.test.ts
git commit -m "feat(aeo): free public AI-visibility checker with 24h cache + strict IP limit"
```

---

### Task 6: Landing-page checker widget

**Files:**
- Create: `src/components/marketing/AIVisibilityChecker.tsx`
- Modify: `src/app/page.tsx` (mount in the AEO scorecard section — the section that renders right after the hero; `InstantTeardown` at line ~188 is the placement pattern)

**Interfaces:**
- Consumes: `POST /api/public/aeo-check` payload/response from Task 5.
- Produces: `export function AIVisibilityChecker()` client component.

**Acceptance criteria:**
- [ ] Two inputs (product name, website URL) + one button; result shows the big `visibility_pct`, per-query mention list, and a signup CTA ("Track this daily — free").
- [ ] 429 shows the "limit reached — sign up" message (that's the conversion path, not an error).
- [ ] Loading, error, and empty states handled; no layout shift bigger than the result card.
- [ ] Renders inside the existing AEO scorecard section of `page.tsx`, above `InstantTeardown`.

- [ ] **Step 1: Write the component**

```tsx
// src/components/marketing/AIVisibilityChecker.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Sparkles, Check, X as XIcon } from "lucide-react";

interface CheckResult {
    brand: string;
    visibility_pct: number;
    total: number;
    mentions: number;
    results: Array<{
        model: string;
        query: string;
        mentioned: boolean;
        excerpt: string | null;
    }>;
}

export function AIVisibilityChecker() {
    const [brand, setBrand] = useState("");
    const [url, setUrl] = useState("");
    const [state, setState] = useState<"idle" | "loading" | "done" | "limited">("idle");
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<CheckResult | null>(null);

    const run = async () => {
        setError(null);
        if (!brand.trim() || !url.trim()) {
            setError("Enter your product name and website.");
            return;
        }
        setState("loading");
        try {
            const res = await fetch("/api/public/aeo-check", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ brand: brand.trim(), url: url.trim() }),
            });
            if (res.status === 429) {
                setState("limited");
                return;
            }
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || "Check failed");
            setResult(body);
            setState("done");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Check failed. Try again.");
            setState("idle");
        }
    };

    return (
        <Card className="glass-card overflow-hidden">
            <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-display text-lg">
                        Does AI recommend you?
                    </h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                    Free check — see whether ChatGPT and Gemini mention your product. No signup.
                </p>

                {state !== "done" && state !== "limited" && (
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                            placeholder="Your product name"
                            value={brand}
                            onChange={(e) => setBrand(e.target.value)}
                            aria-label="Your product name"
                        />
                        <Input
                            type="url"
                            placeholder="https://yourproduct.com"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            aria-label="Your website URL"
                        />
                        <Button
                            className="glow-emerald shrink-0"
                            onClick={run}
                            disabled={state === "loading"}
                        >
                            {state === "loading" ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Asking the AIs…
                                </>
                            ) : (
                                "Check my visibility"
                            )}
                        </Button>
                    </div>
                )}
                {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

                {state === "limited" && (
                    <div className="text-center py-4">
                        <p className="text-sm text-foreground mb-3">
                            You&apos;ve used today&apos;s free checks. Sign up to track your
                            AI visibility daily — free.
                        </p>
                        <Button asChild className="glow-emerald">
                            <Link href="/signup">Start tracking free</Link>
                        </Button>
                    </div>
                )}

                {state === "done" && result && (
                    <div>
                        <div className="flex items-baseline gap-3 mb-4">
                            <span className="text-5xl font-display font-bold text-emerald-400">
                                {result.visibility_pct.toFixed(0)}%
                            </span>
                            <span className="text-sm text-muted-foreground">
                                of AI answers mention {result.brand} ({result.mentions}/{result.total})
                            </span>
                        </div>
                        <ul className="space-y-1.5 mb-4">
                            {result.results.map((r, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs">
                                    {r.mentioned ? (
                                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                    ) : (
                                        <XIcon className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                                    )}
                                    <span className="text-muted-foreground">
                                        <span className="font-mono uppercase text-[10px] mr-1">{r.model}</span>
                                        &ldquo;{r.query}&rdquo;
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <Button asChild className="glow-emerald w-full sm:w-auto">
                            <Link href="/signup">
                                Track this daily vs your competitors — free
                            </Link>
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
```

- [ ] **Step 2: Mount it in `src/app/page.tsx`**

Add the import next to the `InstantTeardown` import (line 9):

```ts
import { AIVisibilityChecker } from "@/components/marketing/AIVisibilityChecker";
```

Render `<AIVisibilityChecker />` inside the AEO scorecard section (the section immediately after the hero — UX-4 moved it above the fold), directly above where the scorecard content ends and before `<InstantTeardown />` (line ~188). Match the surrounding section's container/max-width wrappers exactly as the neighboring blocks do.

- [ ] **Step 3: Verify + commit**

Run: `npm run verify` → green. Then eyeball it: `npm run dev`, open `http://localhost:3000`, submit a known brand (e.g. "Stripe" / `https://stripe.com`) and confirm the result card renders (needs AEO provider API keys in `.env.local`; without keys expect the 502 "models busy" path — that's correct behavior, note it and move on).

```bash
git add src/components/marketing/AIVisibilityChecker.tsx src/app/page.tsx
git commit -m "feat(landing): free AI-visibility checker widget above the fold"
```

---

### Task 7: Citation-source tracking (PAR-2)

**Files:**
- Create: `src/lib/aeo/citations.ts`
- Create: `src/lib/aeo/__tests__/citations.test.ts`
- Create: `src/app/api/aeo/citations/route.ts`
- Modify: `src/components/dashboard/AEOVisibilityCard.tsx` (render top citations)

**Interfaces:**
- Consumes: `aeo_visibility.citations` JSONB (already populated by every scan — array of URL strings).
- Produces: `topCitedDomains(rows: Array<{ citations: unknown }>, limit?: number): Array<{ domain: string; count: number }>` from `src/lib/aeo/citations.ts`; `GET /api/aeo/citations?competitorId=<uuid>&windowDays=30` returning `{ window_days, domains: Array<{ domain, count }> }`.

**Acceptance criteria:**
- [ ] `topCitedDomains` normalizes hosts (strips `www.`), counts across rows, sorts desc by count then alpha, respects `limit`, and silently skips malformed URLs / non-array citations.
- [ ] Route requires auth and filters `.eq("user_id", userId)` (guard test stays green without new allowlist entries).
- [ ] AEOVisibilityCard shows "Sources AI cites" list (top 5) when data exists; renders nothing when empty.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/aeo/__tests__/citations.test.ts
import { describe, it, expect } from "vitest";
import { topCitedDomains } from "../citations";

describe("topCitedDomains", () => {
    it("counts and ranks domains across rows, normalizing www", () => {
        const rows = [
            { citations: ["https://www.g2.com/x", "https://stripe.com/pricing"] },
            { citations: ["https://g2.com/y"] },
            { citations: ["https://reddit.com/r/saas"] },
        ];
        expect(topCitedDomains(rows)).toEqual([
            { domain: "g2.com", count: 2 },
            { domain: "reddit.com", count: 1 },
            { domain: "stripe.com", count: 1 },
        ]);
    });

    it("skips malformed URLs and non-array citations", () => {
        const rows = [
            { citations: ["not a url", "https://g2.com/a"] },
            { citations: null },
            { citations: "https://g2.com" },
        ];
        expect(topCitedDomains(rows)).toEqual([{ domain: "g2.com", count: 1 }]);
    });

    it("respects the limit", () => {
        const rows = [
            { citations: ["https://a.com", "https://b.com", "https://c.com"] },
        ];
        expect(topCitedDomains(rows, 2)).toHaveLength(2);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/aeo/__tests__/citations.test.ts`
Expected: FAIL — `Cannot find module '../citations'`.

- [ ] **Step 3: Implement `src/lib/aeo/citations.ts`**

```ts
/**
 * PAR-2: which sources do answer engines cite? Aggregated from the citation
 * URLs already persisted on every aeo_visibility row.
 */
export function topCitedDomains(
    rows: Array<{ citations: unknown }>,
    limit: number = 10
): Array<{ domain: string; count: number }> {
    const counts = new Map<string, number>();
    for (const row of rows) {
        if (!Array.isArray(row.citations)) continue;
        for (const c of row.citations) {
            if (typeof c !== "string") continue;
            try {
                const domain = new URL(c).hostname.replace(/^www\./, "").toLowerCase();
                counts.set(domain, (counts.get(domain) ?? 0) + 1);
            } catch {
                // malformed citation URL — skip
            }
        }
    }
    return [...counts.entries()]
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain))
        .slice(0, limit);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/aeo/__tests__/citations.test.ts` → PASS (3 tests).

- [ ] **Step 5: Write the route**

```ts
// src/app/api/aeo/citations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { parseQuery } from "@/lib/validation/schemas";
import { topCitedDomains } from "@/lib/aeo/citations";
import { withRequestId, withUser } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

/**
 * GET /api/aeo/citations?competitorId=<uuid>&windowDays=30
 *
 * PAR-2: ranked domains that answer engines cite when discussing this
 * competitor's space — tells the user WHERE to earn mentions.
 */
const querySchema = z.object({
    competitorId: z.string().uuid(),
    windowDays: z.coerce.number().int().min(1).max(90).default(30),
});

export async function GET(request: NextRequest) {
    const { log, headers: reqHeaders } = withRequestId(request, "GET /api/aeo/citations");
    try {
        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401, headers: reqHeaders }
            );
        }
        const userLog = withUser(log, userId);

        const parsed = parseQuery(request, querySchema);
        if (parsed.error) {
            return NextResponse.json(
                await parsed.error.json(),
                { status: 400, headers: reqHeaders }
            );
        }
        const { competitorId, windowDays } = parsed.data;
        const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

        const supabase = createServerClient();
        const { data: rows, error } = await supabase
            .from("aeo_visibility")
            .select("citations")
            .eq("user_id", userId)
            .eq("competitor_id", competitorId)
            .gte("scanned_at", since);

        if (error) {
            userLog.error({ err: error }, "AEO citations query failed");
            throw error;
        }

        return NextResponse.json(
            { window_days: windowDays, domains: topCitedDomains(rows ?? []) },
            { headers: reqHeaders }
        );
    } catch (err) {
        log.error({ err }, "AEO citations failed");
        Sentry.captureException(err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500, headers: reqHeaders }
        );
    }
}
```

- [ ] **Step 6: Render in `AEOVisibilityCard.tsx`**

Add a self-contained section component at the bottom of the file and render it at the end of the card's populated state (it takes `competitorId`, which the card already has):

```tsx
function TopCitations({ competitorId }: { competitorId: string }) {
    const [domains, setDomains] = useState<Array<{ domain: string; count: number }>>([]);

    useEffect(() => {
        fetch(`/api/aeo/citations?competitorId=${competitorId}&windowDays=30`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => setDomains(d?.domains?.slice(0, 5) ?? []))
            .catch(() => {}); // supplementary — fail quietly like the rest of AEO UI
    }, [competitorId]);

    if (domains.length === 0) return null;

    return (
        <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
                Sources AI cites
            </p>
            <ul className="space-y-1">
                {domains.map((d) => (
                    <li key={d.domain} className="flex items-center justify-between text-xs">
                        <span className="text-foreground truncate">{d.domain}</span>
                        <span className="font-mono text-muted-foreground">{d.count}×</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
```

Ensure `useState`/`useEffect` are imported (the card is already a client component fetching `/api/aeo/results` — follow its existing import block).

- [ ] **Step 7: Verify + commit**

Run: `npm run verify` → green; guard test passes without allowlist changes (route filters `user_id`).

```bash
git add src/lib/aeo/citations.ts src/lib/aeo/__tests__/citations.test.ts src/app/api/aeo/citations/route.ts src/components/dashboard/AEOVisibilityCard.tsx
git commit -m "feat(aeo): PAR-2 — citation source ranking per competitor"
```

---

### Task 8: Final verification + operator handoff

**Files:**
- Modify: `docs/PRINCIPAL_REVIEW_AND_LAUNCH_TASKS.md` (progress log)
- Modify: `docs/COMPETITIVE_PARITY_GUIDE.md` (tick PAR-1, PAR-2)

**Acceptance criteria:**
- [ ] `npm run verify` fully green (typecheck:ci + all tests + production build).
- [ ] PAR-1 and PAR-2 checked off in `docs/COMPETITIVE_PARITY_GUIDE.md` with one-line notes.
- [ ] Progress log row added to `docs/PRINCIPAL_REVIEW_AND_LAUNCH_TASKS.md` dated 2026-07-17.
- [ ] Operator checklist (below) reproduced verbatim in the progress-log note.

- [ ] **Step 1: Run full verification**

Run: `npm run verify`
Expected: exit 0. If the test count did not grow by at least 9 (4 ownShare + 2 aggregate + 3 citations), find the missing suite.

- [ ] **Step 2: Update the docs**

In `docs/COMPETITIVE_PARITY_GUIDE.md`, change PAR-1 and PAR-2 to `[x]` with a trailing note: `(shipped 2026-07-17 — see docs/superpowers/plans/2026-07-17-aeo-share-of-voice.md)`.

In `docs/PRINCIPAL_REVIEW_AND_LAUNCH_TASKS.md` progress log, add:

```markdown
| PAR-1/PAR-2 | ✅ Done (2026-07-17) | Own-brand share-of-voice in scans/summary/dashboard, onboarding brand capture, free public AI-visibility checker (`/api/public/aeo-check`, 3/IP/day + 24h cache), citation-source ranking. Operator: apply `supabase/migrations/20260717_own_brand_sov.sql` in Supabase. |
```

- [ ] **Step 3: Operator checklist (not code — surface to the user at the end)**

1. Apply `supabase/migrations/20260717_own_brand_sov.sql` in the Supabase SQL editor (adds `aeo_visibility.own_mentioned/own_position` + `public_aeo_checks`).
2. Confirm AEO provider API keys are set in production env (checker uses gemini + chatgpt providers).
3. Optional: add a retention rule for `public_aeo_checks` (rows are tiny; revisit if the table grows — `// ponytail` ceiling).
4. Existing users have no brand set — the dashboard CTA (Task 4) is the migration path; consider a one-time "set your brand" email.

- [ ] **Step 4: Commit**

```bash
git add docs/PRINCIPAL_REVIEW_AND_LAUNCH_TASKS.md docs/COMPETITIVE_PARITY_GUIDE.md
git commit -m "docs: mark PAR-1/PAR-2 shipped, log operator steps"
```

---

## Self-Review

- **Spec coverage:** PAR-1 (capture brand at onboarding ✓ Task 4; include in scans ✓ Task 2; "your share vs each competitor" ✓ Tasks 2–4). Free checker ✓ Tasks 5–6. PAR-2 citations ✓ Task 7. Supporting launch tasks ✓ Task 8. Weekly visibility email deliberately excluded — depends on PAR-1 data existing for a week; plan it after this ships.
- **Placeholder scan:** none; two known soft spots are called out explicitly rather than hand-waved — exact insertion points in `page.tsx` (line ~188 anchor given) and `AEOVisibilityCard.tsx` (self-contained subcomponent so integration is one render line).
- **Type consistency:** `OwnShare` defined once in `ownShare.ts` (Task 2), consumed by `VisibilitySummary.own` (Task 2), `AggregateVisibility.own` (Task 3, structurally identical inline type), dashboard `Summary` (Task 4). `topCitedDomains` signature identical in Task 7 test/impl/route. `aeoCheckSchema` field names (`brand`, `url`) match route usage and the landing component payload.
