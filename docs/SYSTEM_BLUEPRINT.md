# RivalEye - System Blueprint

> **Status**: Evolution Phase 1 (Post-MVP)
> **Engineering Core**: Contextual Intelligence & Multi-Modal Detection

---

## 🏗️ Architectural Philosophy

RivalEye has evolved from a simple scraper into a **Contextual Intelligence Engine**. The fundamental realization is that **there is no single "price"**; price is a function of region, currency, and visitor state.

### 1. The Contextual Truth Principle
Every analysis run is bound to a `PricingContext`. This ensures:
- **Accuracy**: Comparing US-USD snapshots against previous US-USD snapshots.
- **Transparency**: Telling the user *where* the data came from.
- **Defensibility**: Solving the geo-pricing problem that breaks simpler tools.

### 2. Multi-Modal Change Detection
Instead of relying on fragile HTML diffs, we use a three-tier detection cascade:
- **Tier 1: Vision Extraction** (Ground Truth) — Using Gemini 3 Flash to extract pricing, promos, and positioning from screenshots.
- **Tier 2: Local Signatures** (Static/Zero-Cost) — Identifying tech stack and performance metrics via browser evaluation.
- **Tier 3: Structural Diff** (Meaningfulness) — Heuristic comparison of extracted schemas to detect price parity shifts or feature gating.

---

## 🛠️ The Data Acquisition Tier

### Scraper Cascade Logic
We utilize a budget-conscious, high-reliability cascade:

1.  **Playwright-Geo (Primary)**: Our workhorse. Captures the full-page screenshot for Vision analysis, detects **Tech Stack** signatures, and records **Core Web Vitals**.
2.  **Firecrawl (Specialized Fallback)**: Currently used for high-fidelity **Branding** extraction.
    *   *Strategic Shift*: We are moving Branding extraction to the **Gemini Vision Pipeline** to eliminate this dependency and maximize margins.

### Image Optimization & Storage
- **Capture**: Full-page Playwright screenshot (2-5MB).
- **Processing**: `Sharp` compression (Width 1000px, Quality 60%).
- **Storage**: **Cloudflare R2** with contextual paths.
- **Consumption**: Delivered to Gemini 3 Flash Vision for structured extraction.

---

## 🧠 Intelligence Layer

### AI-First Structured Extraction
We don't just "diff text". We use Gemini to extract a **Pricing Schema**:
```json
{
  "currency": "USD",
  "plans": [
    { "name": "Pro", "price": "$29", "billing": "monthly", "features": [...] }
  ],
  "promotions": ["20% off yearly"],
  "positioning": { "targetAudience": "Indie Hackers" }
}
```

### The "Meaningful" Heuristic
A change is only alerted if it impacts user decisions:
- **High Severity**: Price value change, Plan removal, Feature gating shift.
- **Medium Severity**: Plan name change, Significant repositioning.
- **Low Severity**: CTA rewording, feature bullet polish.

---

## 🎨 VisuaLab Design System

RivalEye adheres to the **VisuaLab Aesthetic** — a dark, architectural, and premium interface designed to evoke trust and precision.

### Design Tokens
| Token | Value | Purpose |
|-------|-------|---------|
| `--background` | `#0A0E1A` | Deep Navy (Stable & Serious) |
| `--primary` | `#10B981` | Emerald (Positive Growth/Insight) |
| `--radius` | `0.625rem` | Modern, soft-tech corners |
| `--font-display` | `Instrument Serif` | Editorial authority |
| `--font-mono` | `Space Mono` | Technical precision |

### Core UI Patterns
- **Noise Overlay**: 3% opacity fractal noise to prevent flat color banding.
- **Saber Borders**: Rotating conic gradients on primary actions (e.g., "Analyze").
- **Glass Morphism**: Thick blur + semi-transparent navy bases for cards.
- **Dot Grid**: Architectural blueprint background for the dashboard.
- **Verified Badges**: Small green ticks next to AI data that link back to the R2 screenshot.

---

## 🚀 Forward Roadmap

### Phase 2: Historical Insights (In Progress)
- **Time-Series Pricing Graphs**: Visualizing price trends over 12 months.
- **Positioning A/B Detection**: Identifying when competitors are testing new headlines.

### Phase 3: Scale & Proxies (Strategic)
- **Residential Proxy Integration**: For bypassing bot detection on enterprise sites (e.g., Salesforce, HubSpot).
- **Advanced Exporting**: PDF/CSV exports for executive presentations.

---

## 🛡️ Security & Reliability
- **Retry Logic**: 3-stage retry for scraping (Firecrawl → Wait → Playwright).
- **Concurrency Control**: Trigger.dev limits to prevent rate-limiting by competitors.
- **Data Privacy**: No user cookies or account data stored within the browser context.
