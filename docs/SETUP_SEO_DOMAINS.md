# SEO Domain Redirect Setup
*Generated: 9 June 2026*

## The 5 domains to buy

Buy on Porkbun, Namecheap, or Cloudflare Registrar. Look for domains with **at least 1-2 years of registration history** (Google trusts aged domains). $10–$50 each.

| Domain | Estimated cost | Redirect target | Why |
|---|---|---|---|
| `competitorwatch.io` | $15 | `/vs/*` (comparison pages) | Direct category match |
| `pricetracker.dev` | $20 | `/track/*` (live tracker pages) | Tech audience, .dev TLD |
| `saas-radar.com` | $20 | `/for/saas` (industry page) | Your value prop |
| `competitorspy.ai` | $20 | `/vs/spyglown` (or similar) | Trendy .ai TLD |
| `startupradar.io` | $15 | `/for/saas` + `/vs/*` | Targets startup ICP |

**Total: ~$90 + $10-15/yr renewal each.**

## DNS Setup (Cloudflare)

1. Buy the domain
2. Add to Cloudflare (free plan)
3. Set nameservers to Cloudflare's
4. SSL/TLS → Full (auto)
5. Add the redirect rules below

## Cloudflare Redirect Rules (one per domain)

In **Cloudflare Dashboard → Rules → Redirect Rules → Create rule**:

### competitorwatch.io
- **Rule name:** `RivalEye to vs/*`
- **Match:** All incoming requests
- **Action:** Dynamic redirect
  - **Expression:** `concat("https://rivaleye.com/vs", lower(uri.path))`
- **Status code:** 301 (permanent)

This sends `competitorwatch.io/klue` → `rivaleye.com/vs/klue` and so on.

### pricetracker.dev
- **Rule name:** `RivalEye to track/*`
- **Action:** Dynamic redirect
  - **Expression:** `concat("https://rivaleye.com/track", lower(uri.path))`
- **Status code:** 301

### saas-radar.com
- **Rule name:** `RivalEye to /for/saas`
- **Action:** Static redirect
  - **Destination URL:** `https://rivaleye.com/for/saas`
- **Status code:** 301

### competitorspy.ai
- **Rule name:** `RivalEye to /vs/spyglown`
- **Action:** Static redirect
  - **Destination URL:** `https://rivaleye.com/vs/spyglown`
- **Status code:** 301

### startupradar.io
- **Rule name:** `RivalEye to /for/saas`
- **Action:** Static redirect
  - **Destination URL:** `https://rivaleye.com/for/saas`
- **Status code:** 301

## Why 301 (permanent)?

301 redirects pass **90-99% of link equity** to the destination URL. That's how you get the aged domain's authority to flow into your new pages.

Never use 302 (temporary) for SEO redirects — Google treats them as soft and doesn't pass equity.

## Optional: Cloudflare Worker for smart routing

If you want different redirects per path, replace the above with a Worker:

```js
// Cloudflare Worker (5 lines, free tier)
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // /track/* and /vs/* pass through
    if (path.startsWith('/track/') || path.startsWith('/vs/')) {
      return Response.redirect(`https://rivaleye.com${path}`, 301);
    }
    
    // Default: /for/saas
    return Response.redirect(`https://rivaleye.com/for/saas`, 301);
  }
};
```

## Indexing timeline

| Week | Expected |
|---|---|
| 1 | Google crawls the redirect rules, follows 301s to rivaleye.com |
| 2-4 | Sitemap submitted, pages start getting discovered |
| 4-8 | Long-tail keywords begin ranking (positions 30-50) |
| 8-16 | Page 1 rankings for low-competition keywords |
| 16-24 | Page 1 rankings for medium-competition keywords |

**Don't expect results in week 1.** SEO is a 3-6 month game.

## Monitor in Google Search Console

1. Add all 6 properties (5 domains + rivaleye.com)
2. Verify via DNS TXT record (Cloudflare makes this easy)
3. Submit sitemap: `https://rivaleye.com/sitemap.xml`
4. Use **URL Inspection** to request indexing of your 30+ new pages
5. Watch **Performance → Search Results** for impressions/clicks

## Don'ts

- ❌ Don't redirect all 5 domains to the same single page (looks spammy to Google)
- ❌ Don't use 302 (temporary) redirects
- ❌ Don't buy fresh-registered domains (no authority)
- ❌ Don't 301 a domain that previously had a manual action from Google (you inherit the penalty)
- ❌ Don't set up 5+ domains at once on a brand-new site (looks like a PBN)
