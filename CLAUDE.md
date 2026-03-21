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

**Server Components + Supabase Edge Functions**

```
Vercel (Next.js 16)
├── Server Components — pages fetch data via server-side Supabase client
├── Dashboard layout — server-side auth check (redirect if not logged in)
├── Client Components — only for interactive leaves (buttons, forms, modals)
└── No API routes, no proxy.ts, no middleware

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

- Next.js 16 + App Router + Turbopack
- Supabase (auth + Postgres + Edge Functions)
- Gemini API (direct fetch in Edge Functions, not AI SDK)
- shadcn/ui + Geist
- Dark mode by default

## Conventions

- Default to Server Components. Only add `'use client'` for interactive elements (buttons, forms, modals, toggles)
- Push `'use client'` boundaries as far down the component tree as possible
- Pages are Server Components that fetch data server-side via `createServerSupabaseClient()`
- Interactive logic lives in `*-client.tsx` components (e.g. `posts-client.tsx`, `settings-client.tsx`)
- Dashboard layout does server-side auth check — no client-side AuthGuard
- DB reads in pages use server-side Supabase client (RLS handles auth)
- DB writes / external API calls go through Edge Functions via `supabase.functions.invoke()`
- For Edge Functions with path routing, use raw `fetch()` to `NEXT_PUBLIC_SUPABASE_URL/functions/v1/<name>/<path>`
- Edge Function shared utilities live in `supabase/functions/_shared/`
- No proxy.ts, no middleware, no API routes
