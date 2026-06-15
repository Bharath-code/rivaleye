-- SEC-4 / PERF-1: indexed public slug for the /track/[slug] public tracker.
--
-- Before: the public API loaded up to 500 active competitors into memory and
-- did an in-memory hostname match on every request (O(n) scan, leaks scale).
-- After: an indexed `public_slug` column derived from the URL hostname, plus a
-- `public_listed` opt-in flag so exposure can be controlled per row.
--
-- NOTE (product decision): `public_listed` defaults to TRUE to preserve the
-- current "viral wedge" behavior where any tracked competitor is publicly
-- visible. Flip the default (or expose a user toggle) if competitors should be
-- private by default.

ALTER TABLE competitors ADD COLUMN IF NOT EXISTS public_slug TEXT;
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS public_listed BOOLEAN NOT NULL DEFAULT true;

-- Derive slug = hostname with dots → dashes (matches the route's normalization:
-- new URL(url).hostname.replace(/\./g, '-')).
CREATE OR REPLACE FUNCTION competitors_set_public_slug() RETURNS trigger AS $$
BEGIN
  NEW.public_slug := replace(
    lower(
      regexp_replace(
        regexp_replace(NEW.url, '^https?://', '', 'i'), -- strip scheme
        '[/:?#].*$', ''                                 -- strip path/port/query/fragment
      )
    ),
    '.', '-'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_competitors_public_slug ON competitors;
CREATE TRIGGER trg_competitors_public_slug
  BEFORE INSERT OR UPDATE OF url ON competitors
  FOR EACH ROW EXECUTE FUNCTION competitors_set_public_slug();

-- Backfill existing rows.
UPDATE competitors
SET public_slug = replace(
  lower(regexp_replace(regexp_replace(url, '^https?://', '', 'i'), '[/:?#].*$', '')),
  '.', '-'
)
WHERE public_slug IS NULL;

-- Partial index covering exactly the public lookup predicate.
CREATE INDEX IF NOT EXISTS idx_competitors_public_slug
  ON competitors (public_slug)
  WHERE status = 'active' AND public_listed = true;
