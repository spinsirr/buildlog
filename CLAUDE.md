# buildlog

Build-in-public assistant. GitHub → AI → multi-platform posts.

## Package Manager

**Always use `bun`. Never use `npm`.**

| Instead of | Use |
|---|---|
| `npm install` | `bun install` |
| `npm install <pkg>` | `bun add <pkg>` |
| `npm install -D <pkg>` | `bun add -d <pkg>` |
| `npm uninstall <pkg>` | `bun remove <pkg>` |
| `npm run <script>` | `bun run <script>` |
| `npx <cmd>` | `bunx <cmd>` |

A PreToolUse hook enforces this — npm commands will be blocked automatically.

## Architecture

**Pure SPA + Supabase Edge Functions**

```
Browser → Vercel (static CDN, output: 'export')
           └── Client-only React (all 'use client' components)
                ├── supabase.from('...') → DB reads (RLS enforced)
                └── supabase.functions.invoke() → Edge Functions (writes)

Supabase Edge Functions (Deno runtime)
  ├── github-webhook — GitHub push/PR/release → AI post generation
  ├── stripe-webhook — subscription lifecycle events
  ├── generate-post — AI content generation (Gemini API)
  ├── create-post — manual post creation with limit checks
  ├── publish-post — publish to Twitter/LinkedIn/Bluesky
  ├── billing — Stripe checkout + portal sessions
  ├── social-auth — Twitter/LinkedIn OAuth + Bluesky credentials
  ├── social-disconnect — disconnect platforms
  ├── github-app — GitHub App installation + repo listing
  └── connect-repo — connect/disconnect repos
```

## Stack

- Next.js 16 + App Router + Turbopack (`output: 'export'` — static SPA)
- Supabase (auth + Postgres + Edge Functions)
- Gemini API (direct fetch in Edge Functions, not AI SDK)
- shadcn/ui + Geist
- SWR for client-side data fetching

## Conventions

- All pages are `'use client'` — no Server Components
- Auth is client-side via `AuthGuard` component (`components/auth-guard.tsx`)
- DB reads use direct Supabase client queries (RLS handles auth)
- DB writes / external API calls go through Edge Functions via `supabase.functions.invoke()`
- For Edge Functions with path routing, use raw `fetch()` to `NEXT_PUBLIC_SUPABASE_URL/functions/v1/<name>/<path>`
- Edge Function shared utilities live in `supabase/functions/_shared/`
- No proxy.ts, no middleware, no API routes
- Dark mode by default
