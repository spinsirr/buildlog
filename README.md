# buildlog

A "build in public" assistant. Connect your GitHub repos and let AI auto-generate social media post drafts from your commits, PRs, and releases. Review drafts and publish to Twitter/X, LinkedIn, and more.

## Tech Stack

- **Next.js 16** — App Router, TypeScript, React 19
- **Supabase** — Auth (GitHub OAuth) + Postgres with RLS
- **Gemini API** — AI post generation (via Supabase Edge Functions)
- **Tailwind CSS** + shadcn/ui — UI components
- **Biome** — Linting and formatting

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/your-username/buildlog
cd buildlog
npm install
```

### 2. Set up environment variables

```bash
cp .env.local.example .env.local
```

Fill in your values:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings → API |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `GITHUB_WEBHOOK_SECRET` | Generate a random string |
| `NEXTAUTH_URL` | `http://localhost:3000` for local dev |

### 3. Set up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the migration in the SQL editor:
   ```
   supabase/migrations/001_initial.sql
   ```
3. Enable GitHub OAuth: Authentication → Providers → GitHub
   - Set callback URL to `http://localhost:3000/auth/callback`

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
app/
  (auth)/login/        — Login page (GitHub OAuth)
  (auth)/callback/     — OAuth callback handler
  (dashboard)/
    dashboard/         — Stats overview
    repos/             — Connected repos
    posts/             — Draft & published posts
  api/
    auth/github/       — Initiates GitHub OAuth flow
    webhooks/github/   — Receives GitHub webhook events
    posts/generate/    — Manual post generation endpoint
lib/
  supabase/            — Supabase client (browser + server)
  ai/                  — AI post generation with Claude
components/
  post-card.tsx        — Post display component
  repo-card.tsx        — Repo display component
supabase/migrations/   — Database schema
proxy.ts               — Auth-based route protection (Next.js 16)
```

## How It Works

1. User signs in with GitHub (Supabase OAuth)
2. User connects a GitHub repo — a webhook is registered on the repo
3. GitHub sends events (push, PR merge, release) to `/api/webhooks/github`
4. The webhook handler verifies the signature and calls Claude to generate a post draft
5. The draft appears in the Posts dashboard for review
6. User publishes to connected social platforms

## Development

```bash
# Lint
npx biome lint .

# Format
npx biome format . --write

# Type check
npx tsc --noEmit
```
