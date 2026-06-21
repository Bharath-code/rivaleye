# Trigger.dev Setup Guide

## 1. Create Trigger.dev Account

1. Go to [trigger.dev](https://trigger.dev)
2. Sign up with GitHub
3. Create a new project called "rivaleye"
4. Copy your **API Key** from the dashboard

## 2. Add Environment Variables

Add to your `.env` file:

```bash
# Trigger.dev
TRIGGER_SECRET_KEY=tr_dev_xxx    # From Trigger.dev dashboard
```

## 3. Deploy Tasks

Run the CLI to deploy your tasks:

```bash
# Login to Trigger.dev
npx trigger.dev@latest login

# Deploy tasks
npx trigger.dev@latest deploy
```

## 4. Tasks Available

### 1. `daily-competitor-analysis` (Scheduled)
- **Cron:** `0 6 * * *` (6 AM UTC daily)
- **Features:**
  - Realtime progress via `metadata.set()`
  - Screenshots all active competitors
  - Gemini vision analysis
  - Change detection with hash comparison
  - Creates alerts for changes

### 2. `analyze-competitor` (On-Demand)
- Triggered from API for single competitor
- Same features as daily task
- Realtime progress updates

## 5. Per-User Schedules

Different plans get different check frequencies:

| Plan | Frequency | Cron |
|------|-----------|------|
| Free | 1x/day | `0 6 * * *` |
| Pro | 4x/day | `0 */6 * * *` |
| Enterprise | Hourly | `0 * * * *` |

### API Endpoints:

```bash
# Create/update schedule
POST /api/schedule
{ "plan": "pro", "timezone": "America/New_York" }

# Get current schedule
GET /api/schedule

# Deactivate schedule
DELETE /api/schedule
```

## 6. Realtime Progress

Tasks report progress via metadata:

```typescript
metadata.set("progress", 50);
metadata.set("status", "Analyzing with AI");
metadata.set("currentCompetitor", "Acme Inc");
```

You can show this in the UI using Trigger.dev Realtime SDK.

## 7. Build Extensions

The `trigger.config.ts` includes:

```typescript
import { playwright } from "@trigger.dev/build/extensions/playwright";

build: {
  extensions: [
    playwright(), // Installs Playwright in container
  ],
}
```

## Architecture

```
Vercel (Frontend + API)
    ↓
Trigger.dev (Background Jobs)
    ├── Scheduled: daily-competitor-analysis
    ├── On-demand: analyze-competitor
    └── Per-user: dynamic schedules
    ↓
Playwright (in Trigger's container)
    ↓
Gemini Vision API
    ↓
Supabase (storage + alerts)
```

## Free Tier Limits

| Resource | Limit |
|----------|-------|
| Runs/month | 10,000 |
| Concurrent runs | 10 |
| Max duration | 5 minutes |

MVP with 50 competitors daily = ~1,500 runs/month ✅

## Test Locally

```bash
# Run dev server (watches for changes)
npx trigger.dev@latest dev

# Test from dashboard
# Go to Tasks → daily-competitor-analysis → Test Run
```

