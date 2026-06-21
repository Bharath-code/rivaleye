# RivalEye - System Overview

## 🎯 What It Does

**Competitor Intelligence Platform** — Monitors competitor pages, detects changes, analyzes with AI, and alerts users.

---

## 👤 User Flows

### 1. Authentication
```
Landing Page → Login/Signup → Supabase Auth → Dashboard
```

### 2. Add Competitor
```
Dashboard → "Add Competitor" Modal
    ├── Enter Name + URL
    ├── Validate URL
    └── Save to `competitors` table
```

### 3. Manual Analysis (On-Demand)
```
Dashboard → Click "🔍 Analyze" Button
    ├── Screenshot page (Playwright)
    ├── Compress image (Sharp → JPEG 75%)
    ├── Send to Gemini Vision API
    ├── Extract structured data:
    │   ├── Pricing plans
    │   ├── Features
    │   ├── Positioning
    │   └── Key insights
    ├── Hash key fields
    ├── Compare with previous hash
    ├── If changed → Create alert
    ├── Store in `analyses` table
    └── Show results in modal
```

### 4. View Alerts
```
Dashboard → Recent Alerts Section
    ├── Show change summary
    ├── Severity badge (High/Medium/Low)
    ├── Click to expand details
    └── Mark as read
```

---

## ⏰ Automated Flow (Cron Job - Every 24h)

```
GET /api/cron (with CRON_SECRET)
    │
    ├── 1. Fetch all active competitors
    │
    ├── 2. For each competitor:
    │   ├── Get previous analysis from DB
    │   ├── Screenshot page (Playwright)
    │   ├── Compress image (Sharp)
    │   ├── Analyze with Gemini Vision
    │   ├── Hash key fields
    │   ├── Compare hashes
    │   │
    │   ├── If CHANGED:
    │   │   ├── Store new analysis
    │   │   ├── Create alert (vision_change)
    │   │   ├── Detect specific changes
    │   │   │   ├── Pricing changes → High severity
    │   │   │   ├── Feature changes → Medium severity
    │   │   │   └── Positioning changes → Medium severity
    │   │   └── Send email via Resend
    │   │
    │   └── If UNCHANGED:
    │       └── Log "No change"
    │
    ├── 3. Update last_checked_at
    │
    └── 4. Rate limit: 2s between competitors
```

---

## 🔧 Technical Architecture

### Data Pipeline
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Playwright │───▶│    Sharp    │───▶│   Gemini    │───▶│  Supabase   │
│ Screenshot  │    │  Compress   │    │   Vision    │    │   Storage   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
     2-5 MB            ~200 KB          Structured         analyses
                                          JSON              table
```

### Change Detection
```
Current Analysis → Hash(pricing + features + positioning)
                            │
                            ▼
               Compare with previous hash
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
         SAME HASH                   DIFFERENT HASH
         (No alert)                  (Create alert)
```

---

## 📊 Database Schema

### Tables
```
users
├── id (UUID)
├── email
└── created_at

competitors
├── id (UUID)
├── user_id (FK)
├── name
├── url
├── is_active
├── last_checked_at
└── failure_count

analyses
├── id (UUID)
├── competitor_id (FK)
├── user_id (FK)
├── analysis_data (JSONB)
├── analysis_hash (VARCHAR)
├── raw_analysis (TEXT)
├── screenshot_size (INT)
├── model (VARCHAR)
├── has_changes (BOOL)
└── created_at

alerts
├── id (UUID)
├── user_id (FK)
├── competitor_id (FK)
├── type (vision_change)
├── severity (high/medium/low)
├── title
├── description
├── details (JSONB)
├── is_read (BOOL)
└── created_at
```

---

## 🔌 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/competitors` | GET | List user's competitors |
| `/api/competitors` | POST | Add new competitor |
| `/api/competitors/[id]` | DELETE | Remove competitor |
| `/api/analyze-competitor` | POST | Vision-based analysis |
| `/api/alerts` | GET | List user's alerts |
| `/api/check-now` | POST | Manual snapshot (legacy) |
| `/api/cron` | GET | Daily automated check |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React, Tailwind |
| Backend | Next.js API Routes |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| AI | Google Gemini 3 Flash |
| Screenshot | Playwright |
| Image Processing | Sharp |
| Email | Resend |
| Hosting | Vercel |

---

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx              # Landing page
│   ├── login/page.tsx        # Auth page
│   ├── dashboard/page.tsx    # Main dashboard
│   └── api/
│       ├── competitors/      # CRUD endpoints
│       ├── alerts/           # Alerts endpoint
│       ├── analyze-competitor/# Vision analysis
│       ├── check-now/        # Manual check
│       └── cron/             # Daily job
│
├── lib/
│   ├── ai/
│   │   ├── aiProvider.ts     # Gemini/OpenRouter
│   │   ├── visionAnalyzer.ts # Screenshot → AI
│   │   └── generateInsight.ts# Text-based insights
│   │
│   ├── crawler/
│   │   ├── index.ts          # Fallback cascade
│   │   ├── firecrawl.ts      # Firecrawl client
│   │   ├── cheerio.ts        # HTML parsing
│   │   ├── playwright.ts     # Browser automation
│   │   └── screenshot.ts     # Screenshot capture
│   │
│   ├── alerts/
│   │   └── sendEmail.ts      # Resend integration
│   │
│   ├── diff/
│   │   ├── normalize.ts      # Text normalization
│   │   ├── diffEngine.ts     # Change detection
│   │   └── isMeaningful.ts   # Change significance
│   │
│   ├── supabase.ts           # DB client
│   ├── auth.ts               # Auth helpers
│   └── types.ts              # TypeScript types
│
└── components/ui/            # Shadcn components
```

---

## 🚀 MVP Features

- [x] User authentication
- [x] Add/remove competitors
- [x] Manual analysis (vision-based)
- [x] Automated daily checks
- [x] Change detection (hash comparison)
- [x] Email alerts
- [x] Dashboard with alerts display
- [x] Image compression

---
## 💡 Key Insights Extracted by AI

1. **Pricing** — Plans, prices, credits, promotions
2. **Features** — Highlighted features, differentiators
3. **Positioning** — Target audience, value proposition
4. **Social Proof** — Customer logos, trust badges
5. **Summary** — Executive-level overview

## � Documentation

Detailed technical documents for specific components:

- [SYSTEM_BLUEPRINT.md](file:///Users/bharath/Desktop/SaaS_projects/rivaleye/SYSTEM_BLUEPRINT.md) — Core architecture, design system, and roadmap.
- [TRIGGER_SETUP.md](file:///Users/bharath/Desktop/SaaS_projects/rivaleye/TRIGGER_SETUP.md) — How to configure and run background jobs.
- [docs/prd.md](file:///Users/bharath/Desktop/SaaS_projects/rivaleye/docs/prd.md) — Original product requirements.
- [docs/strategy_and_vc_audit.md](file:///Users/bharath/Desktop/SaaS_projects/rivaleye/docs/strategy_and_vc_audit.md) — Strategic analysis and business model.

---

## 📈 Status: Post-MVP (Phase 1)
- [x] Context-Aware Pricing Engine
- [x] Multi-modal Diff Engine (Vision + Schema)
- [x] VisuaLab Premium Design System
- [/] Scaling Proxy Infrastructure (Planned)
- [/] Historical Trend Visualization (In Progress)
