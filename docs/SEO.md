# SEO Guide — BuildLog

> Living doc. Update as we ship.

## Strategy

BuildLog's SEO moat is **user-generated changelog pages** (`/changelog/[username]`). Each Pro user creates a long-form, frequently-updated, unique-content page. That's the compounding asset — as the product grows, so does organic surface area.

Everything else supports three goals:

1. **Index every changelog page** (user acquisition flywheel → SEO flywheel)
2. **Rank landing for intent queries** ("turn commits into posts", "dev marketing automation", "build in public tool")
3. **Get picked up by AI search** (ChatGPT, Perplexity) for "tool for X" queries

## Current state

| Asset | Status | File |
|---|---|---|
| Root metadata (title, desc, OG, Twitter) | ✅ | `app/layout.tsx` |
| Per-page `canonical` | ✅ | landing, pricing, examples, changelog |
| Dynamic OG image (landing) | ✅ | `app/opengraph-image.tsx` |
| JSON-LD: SoftwareApplication, Organization, Breadcrumb | ✅ landing only | `app/page.tsx` |
| JSON-LD: FAQPage | ✅ pricing only | `app/pricing/page.tsx` |
| `sitemap.ts` | ⚠️ static, 6 URLs | `app/sitemap.ts` |
| `robots.ts` | ✅ | `app/robots.ts` |
| `manifest.ts` (PWA) | ✅ | `app/manifest.ts` |
| Font display: swap | ✅ | `app/layout.tsx` |
| Supabase preconnect | ✅ | `app/layout.tsx` |

## Priority roadmap

Ranked by ROI. Do in order.

### 🔴 P0 — the moat

**1. Dynamic sitemap (all changelog pages)**
Every user with ≥1 published post should be in `sitemap.xml`. Right now, Google has no way to discover them.

- Query `profiles` where user has published posts, emit `<url>` entry per username
- `lastModified` = latest `published_at` for that user
- `priority`: 0.6, `changeFrequency`: weekly
- File: `app/sitemap.ts`

**2. Per-changelog dynamic OG image**
Currently `/changelog/[username]` uses the user's GitHub avatar as OG. Weak social share.

- Create `app/changelog/[slug]/opengraph-image.tsx`
- Render: user avatar + username + "X posts shipped" + latest 2 post previews
- Use Bauhaus style (coral/yellow/lime) to match landing
- Massively boosts Twitter/LinkedIn share CTR

**3. Changelog Schema.org markup**
Add `CollectionPage` + `Article` per post so Google can surface changelog content in rich results and Discover.

```ts
{
  "@type": "CollectionPage",
  "name": "{user}'s Changelog",
  "mainEntity": {
    "@type": "ItemList",
    "itemListElement": posts.map((p, i) => ({
      "@type": "Article",
      "position": i + 1,
      "headline": p.content.slice(0, 100),
      "datePublished": p.published_at,
      "author": { "@type": "Person", "name": username }
    }))
  }
}
```

### 🟡 P1 — rich results on marketing pages

**4. HowTo schema on landing**
The "3 steps" section is a textbook HowTo. Gets a rich result carousel in Google.

```ts
{
  "@type": "HowTo",
  "name": "Turn shipping into marketing",
  "step": [
    { "@type": "HowToStep", "name": "Connect your repos", "text": "..." },
    { "@type": "HowToStep", "name": "AI reads the diff", "text": "..." },
    { "@type": "HowToStep", "name": "Publish everywhere", "text": "..." }
  ]
}
```

**5. Product + Offer schema on pricing**
Each plan (Free, Pro, Team) as a Product with an Offer. Price shows in Google.

```ts
{
  "@type": "Product",
  "name": "BuildLog Pro",
  "offers": {
    "@type": "Offer",
    "price": "19.90",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock"
  }
}
```

**6. BreadcrumbList on all pages**
Only on landing right now. Add to pricing, examples, changelog. Small win, trivial to implement.

### 🟢 P2 — AI search + content

**7. `public/llms.txt`**
Standard-in-progress for AI crawlers. Tell them what BuildLog is in structured plain text.

```
# BuildLog
BuildLog turns developer shipping activity into ready-to-publish social posts.

## Pages
- /: Landing — product overview
- /pricing: Plans (Free, Pro $19.90/mo, Team)
- /examples: Sample AI-generated posts
- /changelog/{username}: Public build-in-public timeline

## Features
- Code-aware AI (reads diffs, not commit messages)
- Multi-platform: Twitter/X, LinkedIn, Bluesky
- Public changelog pages per user
```

**8. FAQ on landing + FAQPage schema**
Move 3-5 highest-intent FAQs from pricing to landing. Duplicate schema. Rich result expansion under landing search.

**9. Twitter site/creator handles**
Add `twitter.site` and `twitter.creator` to root metadata. Attributes shares to your X account.

**10. Internal linking**
Landing should contextually link to `/pricing` and `/examples` within copy (not just nav). Google rewards topic clusters.

### 🟢 P3 — ongoing

**11. Blog / content hub (`/blog`)**
For organic traffic on long-tail queries: "how to build in public", "developer marketing guide", etc. Big work, big payoff, but not P0.

**12. Track with Search Console**
Register buildlog.ink with Google Search Console + Bing Webmaster. Submit sitemap. Monitor:
- Impressions / clicks per query
- Index coverage (are changelog pages getting indexed?)
- Core Web Vitals

## Implementation notes

### Changelog content is gold — make it crawlable

- Don't put changelog behind any JS gates. Current implementation is a Server Component ✅
- Make sure `published_at` is always set on publish (not `created_at`)
- Canonical URL must be `https://buildlog.ink/changelog/{username}` (no trailing slash, lowercase)

### Don't index the dashboard

- `robots.ts` already disallows `/dashboard/`, `/auth/`, `/api/` ✅
- But also: any page that requires auth should have `<meta name="robots" content="noindex" />` as belt-and-suspenders
- Middleware already redirects unauthed users, but crawlers should be told explicitly

### Core Web Vitals checklist

- [x] Fonts: `display: swap`
- [x] Images: use `next/image` where possible
- [x] Preconnect to Supabase
- [ ] Audit LCP on landing (hero image? no, but the display font swap can cause CLS)
- [ ] Defer non-critical JS (OG analytics scripts if added later)

## Maintenance

- **On every new public page**: add sitemap entry, metadata, OG image, JSON-LD
- **On every 10 Pro users**: sanity-check that changelog pages are getting indexed
- **Quarterly**: re-audit schema markup with Google's Rich Results Test (`search.google.com/test/rich-results`)
- **Quarterly**: Lighthouse audit on landing + a real changelog page

## Quick links

- Google Rich Results Test: https://search.google.com/test/rich-results
- Schema.org reference: https://schema.org/docs/schemas.html
- Search Console: https://search.google.com/search-console
- OG image debugger (Facebook): https://developers.facebook.com/tools/debug/
- Twitter card validator: https://cards-dev.twitter.com/validator
