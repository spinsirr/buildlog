# BuildLog

Your team ships every day. BuildLog turns it into marketing. Connect your GitHub repos and let AI auto-generate social media posts from your commits, PRs, and releases. Review drafts and publish to Twitter/X, LinkedIn, and Bluesky.

**Live at [buildlog.ink](https://buildlog.ink)**

## Tech Stack

- **Next.js 16** — App Router, React 19, Turbopack
- **Supabase** — Auth (GitHub OAuth), Postgres with RLS, Edge Functions (Deno)
- **Gemini API** — AI post generation via Edge Functions
- **Tailwind CSS** + **shadcn/ui** — UI components
- **Biome** — Linting and formatting
- **bun** — Package manager

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/spencerzhao2/buildlog
cd buildlog
bun install
```

### 2. Set up environment variables

```bash
cp .env.local.example .env.local
```

Key variables:

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `NEXT_PUBLIC_GITHUB_APP_NAME` | Your GitHub App slug |
| `GITHUB_APP_ID` | GitHub App settings |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App → Generate private key |

Edge Function secrets (set via `supabase secrets set`):

| Secret | Purpose |
|---|---|
| `GEMINI_API_KEY` | AI post generation |
| `CORS_ORIGIN` | Allowed origin (e.g. `https://buildlog.ink`) |
| `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET` | Twitter/X OAuth |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Billing |

### 3. Set up Supabase

1. Create a Supabase project
2. Run `supabase/migrations/001_initial.sql` in the SQL editor
3. Enable GitHub OAuth under Authentication → Providers

### 4. Run

```bash
bun run dev
```

## Architecture

```
Next.js 16 (Vercel)
├── Server Components — data fetching via server-side Supabase client
├── Client Components — interactive UI (forms, modals, toggles)
└── app/api/agent/decide — Agentic decision engine (Gemini via AI SDK)

Supabase Edge Functions (Deno)
├── github-webhook    — GitHub events → AI post generation
├── github-app        — GitHub App installation + repo listing
├── connect-repo      — Connect/disconnect repos
├── generate-post     — Gemini AI content generation
├── create-post       — Manual post creation
├── publish-post      — Publish to Twitter/LinkedIn/Bluesky
├── social-auth       — OAuth flows for social platforms
├── social-disconnect — Disconnect platforms
├── billing           — Stripe checkout + portal
├── stripe-webhook    — Subscription lifecycle
└── _shared/          — Auth, CORS, AI, social API helpers
```

## How It Works

1. Sign in with GitHub (Supabase OAuth)
2. Install the BuildLog GitHub App on your repos
3. GitHub sends events (push, PR, release) to the webhook Edge Function
4. An AI agent decides whether to post, skip, or bundle for later, then generates content
5. Review and edit drafts in the dashboard
6. Publish to connected social platforms

## Development

```bash
bun run dev          # Next.js dev server
bun run check        # Biome lint + format check
bun run typecheck    # TypeScript type check
bun run test         # Run tests (vitest)
```
