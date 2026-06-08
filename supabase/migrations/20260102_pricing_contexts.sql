-- ══════════════════════════════════════════════════════════════════════════════
-- RivalEye Geo-Aware Pricing Schema
-- Migration: 20260102_pricing_contexts
-- ══════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. PRICING CONTEXTS TABLE
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists pricing_contexts (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  country text,
  currency text,
  locale text not null,
  timezone text not null,
  requires_browser boolean default false,
  created_at timestamptz default now()
);

insert into pricing_contexts (key, country, currency, locale, timezone, requires_browser)
values
  ('us', 'US', 'USD', 'en-US', 'America/New_York', true),
  ('in', 'IN', 'INR', 'en-IN', 'Asia/Kolkata', true),
  ('eu', 'DE', 'EUR', 'en-DE', 'Europe/Berlin', true),
  ('global', null, null, 'en-US', 'UTC', false)
on conflict (key) do nothing;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. PRICING SNAPSHOTS TABLE
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists pricing_snapshots (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references competitors(id) on delete cascade,
  pricing_context_id uuid not null references pricing_contexts(id),
  source text not null check (source in ('firecrawl', 'playwright')),
  currency_detected text,
  pricing_schema jsonb not null,
  dom_hash text,
  screenshot_path text,
  taken_at timestamptz default now()
);

create index if not exists idx_pricing_snapshots_competitor_context 
  on pricing_snapshots (competitor_id, pricing_context_id, taken_at desc);

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. PRICING DIFFS TABLE
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists pricing_diffs (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references competitors(id) on delete cascade,
  pricing_context_id uuid not null references pricing_contexts(id),
  snapshot_before_id uuid references pricing_snapshots(id),
  snapshot_after_id uuid not null references pricing_snapshots(id),
  severity numeric not null check (severity >= 0 and severity <= 1),
  diff_type text not null,
  diff jsonb not null,
  summary text not null,
  ai_explanation text,
  is_notified boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_pricing_diffs_competitor 
  on pricing_diffs (competitor_id, created_at desc);

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. SCREENSHOTS STORAGE BUCKET
-- ──────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'screenshots',
  'screenshots',
  true,
  5242880,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create policy "Allow service role full access"
  on storage.objects for all
  to service_role
  using (bucket_id = 'screenshots');

create policy "Allow public read"
  on storage.objects for select
  to public
  using (bucket_id = 'screenshots');

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. HELPER FUNCTION
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function get_latest_snapshot(
  p_competitor_id uuid,
  p_context_id uuid
) returns pricing_snapshots as $$
  select *
  from pricing_snapshots
  where competitor_id = p_competitor_id
    and pricing_context_id = p_context_id
  order by taken_at desc
  limit 1;
$$ language sql stable;

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. UPDATE COMPETITORS TABLE
-- ──────────────────────────────────────────────────────────────────────────────
alter table competitors 
  add column if not exists best_scraper text check (best_scraper in ('firecrawl', 'playwright'));
