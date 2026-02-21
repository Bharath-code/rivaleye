# RivalEye

**Competitive intelligence that thinks.** Monitor competitor pricing, tech stack, and branding across 4 global regions. When they move, get an AI tactical brief — not just a notification.

## What It Does

- **Price Monitoring** — Detects increases, decreases, and sneaky regional discounts
- **Tech Stack Detection** — Alerts when competitors add Stripe, switch to Next.js, adopt new analytics
- **Branding Analysis** — Catches color, font, and logo changes that signal repositioning
- **Geo-Aware Pricing** — Monitors from 4 regions (US, EU, India, Global) to uncover hidden strategies
- **AI Tactical Briefs** — Every change comes with what happened, why it matters, and what to do next
- **Core Web Vitals** — Track competitor performance and capitalize on their UX gaps

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, GSAP, Radix UI |
| Backend | Next.js API Routes, Supabase (Postgres + RLS + Auth) |
| AI | Google Gemini (Vision), OpenRouter |
| Crawling | Firecrawl, Playwright, Cheerio (3-scraper fallback) |
| Jobs | Trigger.dev |
| Billing | Dodo Payments |
| Alerts | Resend (email), Slack webhooks |
| Analytics | PostHog, Cloudflare Web Analytics |
| Storage | Cloudflare R2 (screenshots) |

## Getting Started

### Prerequisites

- Node.js 20.9+
- Supabase project
- API keys for Firecrawl, Google Gemini, Dodo Payments

### Setup

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Run the database schema
# → Copy supabase/schema.sql into Supabase SQL Editor

# Start dev server
npm run dev
```

### Environment Variables

See `.env.example` for all required keys. At minimum you need:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FIRECRAWL_API_KEY`
- `DODO_PAYMENTS_API_KEY` / `DODO_PAYMENTS_WEBHOOK_KEY`

## Architecture

```
src/
├── app/
│   ├── api/            # 14 API routes (competitors, alerts, billing, analysis)
│   ├── dashboard/      # Main dashboard with market radar, competitor cards, alerts
│   ├── login/          # Auth page
│   └── page.tsx        # Landing page
├── components/
│   ├── alerts/         # Alert summary, alert cards
│   ├── charts/         # Market radar, pricing trends
│   ├── onboarding/     # First-run wizard
│   └── ui/             # Shadcn/Radix primitives
├── lib/
│   ├── ai/             # Vision analyzer, insight generator, AI provider
│   ├── alerts/         # Email, Slack, branding/tech/performance alerts
│   ├── billing/        # Feature flags, plan limits
│   ├── crawler/        # Firecrawl, Playwright, Cheerio, geo-proxy, guardrails
│   ├── diff/           # Pricing diff engine, meaningfulness checks, alert rules
│   └── *.ts            # Auth, encryption, quotas, abuse detection
└── trigger/            # Background jobs (daily analysis, pricing checks, retention)
```

## Plans

| | Free | Pro ($49/mo) |
|---|---|---|
| Competitors | 1 | 5 |
| Scans | Daily | Daily + on-demand |
| Regions | 1 (Global) | 4 (US, EU, IN, Global) |
| AI Tactical Briefs | — | ✓ |
| Tech Stack Alerts | — | ✓ |
| Branding Alerts | — | ✓ |
| Core Web Vitals | — | ✓ |
| Slack Integration | — | ✓ |
| Alert History | 7 days | Unlimited |

## Scripts

```bash
npm run dev          # Development server (Turbopack)
npm run build        # Production build
npm run test         # Run tests (Vitest)
npm run test:coverage # Tests with coverage
npm run lint         # ESLint
```

## License

Proprietary. All rights reserved.