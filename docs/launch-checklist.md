# RivalEye — Launch Checklist

**Product:** RivalEye, a web app that watches your competitors (pricing, tech, branding, and how often AI assistants mention them) and tells you your own "share of AI answers."
**Stack in plain English:** The website runs on Vercel (Next.js). Your data lives in Supabase (a hosted Postgres database). Background scans run on Trigger.dev. Payments go through Dodo Payments. Email via Resend, analytics via PostHog, error alarms via Sentry, screenshots on Cloudflare R2.
**Estimated time to live:** ~1 working day of focused steps, plus up to 1 day of DNS/email waiting.
**Estimated monthly cost at launch:** ~$40–90 (Vercel Pro $20, Supabase Pro $25 optional at first, Firecrawl ~$16, AI usage a few dollars — capped by `AEO_SCAN_COST_CEILING_USD`; most other services have free tiers that are fine for launch).

Legend:
- 🧑 **You** — needs your identity, accounts, payment details, or a decision.
- 🤖 **Agent** — paste the quoted prompt into your coding agent.
- 🤝 **Together** — the agent prepares it, you click the final button or paste a value.

---

## Phase 0 — Code blockers (mostly done today)

- [x] 🤖 **Fix the broken "Add your brand" link** (was pointing at a page that doesn't exist) — done 2026-07-18.
- [x] 🤖 **Add a Brand Name field to Settings** so existing users (not just new signups) can turn on "your share of AI answers" — done 2026-07-18.
- [x] 🤖 **Create /privacy and /terms pages** (footer linked to them but they 404'd) — done 2026-07-18.
- [ ] 🧑 **Read the new /privacy and /terms pages** (5 min). They're honest drafts based on what the app actually does, but you're the one legally on the hook — adjust the contact email and anything that doesn't match reality.
  **You'll know it worked when...** you'd be comfortable with a customer reading every sentence.
- [ ] 🤝 **Merge this branch into main** (10 min). All launch work lives on the `worktree-aeo-share-of-voice` branch; `main` doesn't have it yet.
  > Commit the current changes on worktree-aeo-share-of-voice, run `npm run verify:local`, then merge the branch into main and push.

  **You'll know it worked when...** `git log main` shows the PAR-1/PAR-2 commits and `npm run verify:local` passes on main.

## Phase 1 — Accounts you need (skip any you already have)

- [ ] 🧑 **Confirm accounts exist and are on the right tier** (15 min): Vercel (Pro, $20/mo — needed for longer function timeouts), Supabase (free is OK to start), Trigger.dev (free tier), Firecrawl (~$16/mo starter), Dodo Payments (verified for live payments — verification can take days, start early), Resend (free), Upstash Redis (free), Cloudflare (R2 + Turnstile, ~free), PostHog (free), Sentry (free), plus AI keys: Google AI Studio (Gemini — required), OpenRouter, Perplexity, Anthropic, SerpAPI.
  **You'll know it worked when...** you can log into each dashboard and see an API key page.

## Phase 2 — Secrets and configuration

*An environment variable is a setting stored outside your code, used for secrets like API keys. Never paste these into chat or commit them to the repo — they go straight into Vercel's dashboard (Project → Settings → Environment Variables).*

- [ ] 🤝 **Set every variable from `.env.example` in Vercel** (30 min). The file is the complete list — including three that were missing until today: `NEXT_PUBLIC_APP_URL` (set to `https://rivaleye.app`), `ENCRYPTION_KEY` (generate with `openssl rand -hex 32` in your terminal), and `GOOGLE_PSI_API_KEY`.
  > Read .env.example and print a table of every variable, which service issues it, and the exact dashboard URL where I create the live key. Flag any that are optional.

  **You'll know it worked when...** a Vercel deploy succeeds — the build literally refuses to start without `NEXT_PUBLIC_SUPABASE_URL`, so a green build means the core secrets are in.
- [ ] 🧑 **Switch Dodo Payments to live mode** (15 min): in the Dodo dashboard create the live Pro product ($49/mo — must match the price in the app), set `DODO_PAYMENTS_ENVIRONMENT=live_mode`, live API key, live `DODO_PRO_PRODUCT_ID`, and point the webhook (a way for Dodo to automatically notify your app when a payment succeeds) at `https://rivaleye.app/api/webhook`.
  **You'll know it worked when...** Dodo's webhook test shows a 2xx response from your app.

## Phase 3 — Production services

- [ ] 🤝 **Apply the two newest database migrations to production Supabase** (10 min): `20260615_public_slug.sql` (public tracking pages break without it) and `20260717_own_brand_sov.sql` (own-brand share + free checker cache — the flagship feature reads these columns).
  > Print the contents of supabase/migrations/20260615_public_slug.sql and 20260717_own_brand_sov.sql so I can paste them into the Supabase SQL editor, and tell me how to verify each applied.

  **You'll know it worked when...** running `select own_mentioned from aeo_visibility limit 1` in the Supabase SQL editor returns without an "column does not exist" error.
- [ ] 🤝 **Deploy the Trigger.dev background jobs** (15 min) — these run the daily scans; without them the app is a pretty dashboard that never updates.
  > Follow docs/TRIGGER_SETUP.md and deploy the trigger jobs to production; confirm the daily pricing and AEO monitor schedules are registered.

  **You'll know it worked when...** the Trigger.dev dashboard lists the jobs with green "deployed" status and a next-run time.
- [ ] 🧑 **Verify your sending domain in Resend** (10 min + up to a day of DNS wait): add the DNS records Resend gives you so alert emails come from `alerts@rivaleye.app` instead of landing in spam. Set `RESEND_FROM_EMAIL` to match.
  **You'll know it worked when...** Resend shows the domain as "Verified" and a test email lands in your inbox, not spam.
- [ ] 🧑 **Create Turnstile keys for the real domain** (5 min): in Cloudflare, add `rivaleye.app` as an allowed hostname for the Turnstile widget (the invisible bot check on the free tools). Test keys will silently fail in production.
  **You'll know it worked when...** the free AI-visibility checker on the landing page completes a check while you're logged out.

## Phase 4 — Deploy

- [ ] 🤝 **Connect the repo to Vercel and deploy main** (15 min). Vercel auto-detects Next.js; no config file needed.
  **You'll know it worked when...** the `*.vercel.app` preview URL loads the landing page with the checker widget.

## Phase 5 — Domain

*DNS is the address book that points your domain name at your app's server. Changes can take up to a day to spread.*

- [ ] 🧑 **Point `rivaleye.app` at Vercel** (15 min + DNS wait): add the domain in Vercel → Domains, then set the DNS records it shows you at your registrar. Note: some infra (PostHog ingress rewrite, R2 screenshot URL) still references `rivaleye.com` — decide once: `.app` is canonical, so update those two to `.app` subdomains, or keep them and don't worry (they work either way, they're just inconsistent).
- [ ] 🧑 **Update Supabase auth for the real domain** (10 min): Supabase → Authentication → URL Configuration → set Site URL to `https://rivaleye.app` and add it to redirect URLs; update the Google OAuth authorized redirect too.
  **You'll know it worked when...** `https://rivaleye.app` loads over HTTPS and Google login round-trips back to your dashboard, not localhost.

## Phase 6 — Pre-launch smoke test (do this as a real customer)

- [ ] 🧑 **The full journey** (30 min), on your phone as well as laptop:
  1. Open the landing page logged-out → run the free AI-visibility checker → get a result.
  2. Sign up with a fresh email → onboarding asks for your brand name → add one competitor.
  3. Wait for/trigger the first scan → dashboard shows competitor data and "your share vs them."
  4. Settings → change email frequency, set your brand name, save — no errors.
  5. Upgrade to Pro with a **real card** → confirm the plan flips to Pro → then refund yourself in the Dodo dashboard and confirm downgrade.
  6. Check the alert email arrives and isn't in spam.
  **You'll know it worked when...** every step above passes without you touching a database or log. The product is not "launched" until this passes.

## Phase 7 — After launch

- [ ] 🤝 **Confirm Sentry receives errors** (10 min): trigger a deliberate error on a test page and see it appear in Sentry. This is your smoke alarm.
- [ ] 🧑 **Turn on Supabase backups** (5 min): Supabase → Database → Backups. Free tier keeps daily backups 7 days; Pro keeps more.
- [ ] 🧑 **Watch two numbers weekly**: PostHog signup-funnel conversion, and AI spend vs. the `AEO_SCAN_COST_CEILING_USD` cap (a runaway scan bill is the main cost risk).
- [ ] 🧑 **When something breaks, look in this order**: Sentry (app errors) → Vercel logs (request failures) → Trigger.dev runs (scan failures) → Supabase logs (database).

---

**Open engineering items that are fine to launch with** (tracked in `docs/PRINCIPAL_REVIEW_AND_LAUNCH_TASKS.md`): motion/Lighthouse polish, further UX activation work. Security P0s, pricing reconciliation, rate limiting (Upstash), and cost caps are all done.
