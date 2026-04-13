# BuildLog

Your team ships every day. BuildLog turns it into marketing. Connect your GitHub repos and let AI auto-generate social-media posts from your commits, PRs, and releases. Review drafts and publish to Twitter/X, LinkedIn, and Bluesky.

**Live at [buildlog.ink](https://buildlog.ink)**

## Tech Stack

- **Next.js 16** — App Router, React 19, Turbopack, Proxy (renamed from middleware)
- **Supabase** — Auth (GitHub OAuth), Postgres with RLS, Edge Functions (Deno)
- **Vercel Functions** — AI SDK + Gemini for all generation (edge fns proxy here)
- **Tailwind CSS v4** + **shadcn/ui** — UI with Bauhaus-style neo tokens
- **Biome** + **ESLint** — linting / formatting
- **bun** — package manager

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/spinsirr/buildlog
cd buildlog
bun install
```

### 2. Environment variables

```bash
cp .env.local.example .env.local
```

**Vercel / Next.js env (put in `.env.local` for dev, and set in Vercel dashboard):**

| Variable | Source | Needed in |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | all |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | all |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | server only |
| `NEXT_PUBLIC_GITHUB_APP_NAME` | Your GitHub App slug | all |
| `GITHUB_APP_ID` | GitHub App settings | server only |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App → Generate private key | server only |
| `GEMINI_API_KEY` | [AI Studio](https://aistudio.google.com/apikey) — must start with `AIzaSy...` | server only (Vercel) |
| `AGENT_API_SECRET` | Generate once: `openssl rand -hex 32`. Must match between Vercel and Supabase. | server only |

**Supabase Edge Function secrets (`supabase secrets set KEY=value`):**

| Secret | Purpose |
|---|---|
| `AGENT_API_SECRET` | Auth for edge fns calling `/api/agent/*` on Vercel (same value as above) |
| `BUILDLOG_APP_URL` | Base URL for Vercel, e.g. `https://buildlog.ink` |
| `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` / `GITHUB_WEBHOOK_SECRET` | GitHub App integration |
| `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET` | Twitter/X OAuth |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Billing |
| `CORS_ORIGIN` | Allowed origin, e.g. `https://buildlog.ink` |

### 3. Supabase setup

```bash
supabase link --project-ref <your-ref>
supabase db push              # applies all migrations in supabase/migrations/
supabase functions deploy     # deploys every edge fn
```

Enable GitHub OAuth in Supabase → Authentication → Providers.

### 4. Run locally

```bash
bun run dev
```

## Architecture

```
Next.js 16 (Vercel)
├── proxy.ts                — auth redirects (protects /dashboard /posts /repos /settings /usage /login)
├── app/(marketing)         — landing, pricing, examples, /changelog directory (Server Components)
├── app/(dashboard)         — /dashboard /posts /repos /settings /usage (client, SWR)
├── app/changelog/[username]— public build-in-public timeline per user
├── app/api/agent/
│   ├── decide              — ranker (two-phase: rankEvent + generateContent)
│   ├── generate            — single-event content generator
│   ├── xhs                 — XHS-style bilingual (en / zh) variant
│   ├── intro               — first-time repo intro post
│   └── recap               — weekly / branch recap from GitHub activity
└── lib/
    ├── agent/              — orchestrator, generators, prompts, types
    ├── ai/provider.ts      — shared getGoogleProvider + middleware wrapper
    └── hooks/               — SWR data hooks per page

Supabase Edge Functions (Deno)
├── github-webhook          — push/PR/release events → pre-filter → ranker → draft
├── generate-post           — manual create / regenerate / xhs-copy (proxies to Vercel)
├── generate-recap          — weekly / branch recap (proxies to Vercel)
├── connect-repo            — connect/disconnect GitHub repos + intro post
├── backfill-context        — one-shot script to backfill repo context + intro posts
├── publish-post            — publish to Twitter/LinkedIn/Bluesky
├── social-auth / social-disconnect — OAuth flows
├── billing                 — Stripe checkout + portal
├── stripe-webhook          — subscription lifecycle
├── github-app              — GitHub App installation + repo listing
├── create-post             — manual text-only post
└── _shared/
    ├── vercel-ai.ts        — single seam for calling Vercel /api/agent/*
    ├── github.ts           — GitHub API (installation token, diffs via compare API)
    ├── auth.ts             — requireUser helper
    └── ...                 — crypto, cors, logger, publish, subscription, etc.
```

## How It Works

1. Sign in with GitHub (Supabase OAuth)
2. Install the BuildLog GitHub App on your repos
3. GitHub push/PR/release → webhook edge fn
4. **Pre-filter** drops obvious noise (merge commits, lockfile-only, CI-only, docs+chore) with zero AI cost
5. For surviving events, `fetchCommitContext` pulls the real diff via GitHub's compare API
6. **Ranker** (Vercel, Gemini) labels the event `high` or `low` signal and picks an angle
7. **Content generator** writes the post with the real diff + angle
8. Draft lands in your dashboard (high-signal shown by default, low folded under a disclosure)
9. You review, optionally regenerate or generate an XHS-style English/中文 variant, and publish
10. Your published posts surface on your public `/changelog/<username>` page

## Development

```bash
bun run dev          # Next.js dev server
bun run check        # Biome lint + format
bun run lint         # ESLint
bun run typecheck    # TypeScript
bun run test         # Vitest
bun run backend:check # deno lint + fmt on edge functions
```

## Deployment

- **Vercel** auto-deploys on push to `main` (prod) and every PR (preview).
- **Supabase Edge Functions** — push with `supabase functions deploy <name>`.
- **DB migrations** — `supabase db push`.
- **Secrets** — Vercel dashboard + `supabase secrets set`.

## Docs

- `docs/SEO.md` — SEO roadmap (dynamic sitemap done, HowTo / Product schema / llms.txt next)
- `docs/github-marketplace-listing.md` — GitHub Marketplace copy
- `CHANGELOG.md` — release notes
- `TODOS.md` — pending work (SWR prefetch, cross-page cache sharing)
