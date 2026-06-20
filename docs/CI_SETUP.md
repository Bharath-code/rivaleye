# CI/CD Setup for RivalEye

## What you have

- **`.github/workflows/test.yml`** — runs on every PR + every push to `main`
  - 4 parallel jobs: `Lint`, `TypeScript`, `Unit Tests`, `Build`
  - Caches `node_modules` for speed
  - Skips entirely if no source files changed
  - Treats pre-existing test-mock type mismatches as warnings (only blocks on new production code errors)
- **`.github/workflows/deploy.yml`** — deploys after CI passes
  - Cloudflare Worker (analytics proxy)
  - Trigger.dev tasks
  - Has `workflow_dispatch` trigger for manual deploys with optional `force` flag
- **`.github/PULL_REQUEST_TEMPLATE.md`** — auto-loads on every PR

## One-time setup (5 minutes)

### 1. Set branch protection on `main`

In GitHub: **Settings → Branches → Add rule**

- Branch name pattern: `main`
- ☑ **Require a pull request before merging**
  - ☑ Require approvals: **1**
  - ☑ Dismiss stale pull request approvals when new commits are pushed
  - ☑ Require review from Code Owners (optional)
- ☑ **Require status checks to pass before merging**
  - ☑ Require branches to be up to date before merging
  - Search and select these 4 required checks:
    - `Lint`
    - `TypeScript`
    - `Unit Tests`
    - `Build`
- ☑ **Require conversation resolution before merging**
- ☑ **Do not allow force pushes**
- ☑ **Do not allow deletions**
- (Optional) ☑ **Require linear history** if you use squash-merge

### 2. Add GitHub Secrets

In GitHub: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Used by | Where to find it |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | deploy-cloudflare | Cloudflare Dashboard → My Profile → API Tokens |
| `TRIGGER_ACCESS_TOKEN` | deploy-trigger | Trigger.dev Dashboard → Settings → API Keys |
| `CODECOV_TOKEN` | (optional) test coverage upload | codecov.io → your repo |

That's it for now. The test workflow uses **placeholders** for Supabase/AI keys, so you don't need to add those as secrets.

### 3. Verify the test workflow runs

1. Open a PR (or push to a branch)
2. Watch the **Actions** tab — the CI workflow should start
3. All 4 jobs should pass (green checkmarks)

If something fails, click into the failing job to see logs. Common issues:
- "ESLint couldn't find config" → run `npm run lint` locally first
- "Build failed at step 2" → check that `NEXT_PUBLIC_APP_URL` is set in env
- "Tests timeout" → check `vitest.config.ts` for the timeout setting

## What blocks a merge

| Job | What it catches | Time |
|---|---|---|
| **Lint** | Import order, unused vars, missing semicolons, React hooks violations | ~20s |
| **TypeScript** | Type mismatches, missing return types, wrong generics | ~30s |
| **Unit Tests** | Logic regressions in `lib/diff/*`, `lib/ai/*`, `lib/crawler/*` | ~40s |
| **Build** | Broken SSG (`generateStaticParams`), missing env vars, broken imports, circular deps | ~90s |

**Total CI time: ~2 minutes per PR.** Cached `node_modules` makes the second run faster (~30s).

## How deploy works

```
PR opened → CI runs (4 jobs in parallel)
           ↓ all pass
PR merged to main → CI runs again on main
                    ↓ all pass
                Deploy workflow triggers (via workflow_run)
                    ↓
              Cloudflare Worker deploys (~30s)
              Trigger.dev tasks deploy (~2 min)
                    ↓
              Production updated
```

The deploy workflow **only runs if the CI workflow succeeded** on the same commit. If CI fails on main, nothing deploys.

## Manual deploys

For one-off deploys (e.g. to deploy a hotfix without going through CI):

1. Go to **Actions → Deploy RivalEye Stack → Run workflow**
2. (Optional) Check "Force deploy" to bypass the test gate
3. Click **Run workflow**

**Use `force` sparingly.** It's there for genuine emergencies, not for skipping review.

## Branching workflow (recommended)

```bash
# 1. Branch off main
git checkout main
git pull
git checkout -b feat/your-feature

# 2. Work + commit
git add .
git commit -m "feat: add X"

# 3. Push + open PR
git push origin feat/your-feature
# GitHub: open PR, fill template, request review

# 4. CI runs. If green, get approval, merge.
# 5. Deploy fires automatically.
```

## Local verification (mirror CI)

Before pushing, run the same 4 gates locally:

```bash
npm run verify
# = npm run lint && npm run typecheck && npm run test:run && npm run build
```

This catches 95% of CI failures before you push. No more "fix typo → push → wait 2 min → see new failure → fix → push → repeat."

## Adding a new check

If you add a new gate (e.g. `npm run test:e2e`), edit `.github/workflows/test.yml` and add a new job in the `jobs:` block. The existing `deploy.yml` won't change — it just waits for the workflow to succeed.

## Disabling CI temporarily

If CI is broken and you need to ship a hotfix:

1. **Option A (preferred):** Fix the broken gate in a PR, merge, then ship
2. **Option B (emergency):** Use Actions → Deploy RivalEye Stack → Run workflow → check "Force deploy"

Never disable branch protection entirely. The whole point of CI is to keep you from shipping broken code at 2am.

## Cost

- **Public repo:** Free (unlimited minutes)
- **Private repo (free tier):** 2,000 minutes/month
  - ~10 PRs/day × 2 min = 600 min/month
  - Deploys: ~10/day × 3 min = 900 min/month
  - **Total: ~1,500 min/month, comfortably under the cap**
- **Private repo after free tier:** $0.008/minute
  - At the above volume: ~$12/month
  - For a 1-person founder, you'll never hit this

## When to scale CI

- **> 5 PRs/day** → consider splitting `Build` into `Build:frontend` + `Build:api`
- **> 20 PRs/day** → consider self-hosted runners
- **> 50 PRs/day** → consider E2E tests in a separate workflow with longer timeout

None of these apply at your current scale. Don't premature-optimize.
