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

**Proxy Auth + Client-Side Dashboard + Vercel AI Layer + Supabase Edge Functions**

```
Vercel (Next.js 16)
├── proxy.ts — auth redirects, matcher covers /dashboard, /posts, /repos, /settings, /usage, /login
│   (Next 16 renamed this file convention from middleware.ts to proxy.ts; the exported
│    function is `proxy()` too.)
├── Dashboard pages — 'use client' with SWR hooks, URLs are /dashboard, /posts, /repos,
│   /settings, /usage (the (dashboard) route group doesn't add /dashboard prefix)
│   ├── AuthProvider — client-side session context (exposes userId)
│   ├── SWR hooks — lib/hooks/use-dashboard-data.ts (conditional keys with userId)
│   └── Mutations invalidate SWR cache via useSWRConfig().mutate(<predicate>)
├── Landing/auth/changelog pages — Server Components via createServerSupabaseClient()
├── Client Components — interactive leaves (buttons, forms, modals)
│
├── app/api/agent/           — five routes, all gated by verifyAgentSecret (timingSafeEqual)
│   ├── decide/              — ranker pipeline (called by github-webhook)
│   ├── generate/            — single-event content (webhook fallback + regenerate)
│   ├── xhs/                 — XHS-style bilingual (lang: 'en' | 'zh')
│   ├── intro/               — first-time repo intro post
│   └── recap/                — weekly / branch recap
│
├── lib/agent/
│   ├── orchestrator.ts      — runAgent / runAgentSafe (two-phase: rankEvent + generateContent)
│   ├── generators.ts        — generateContent / generateIntroPost / generateXhsPost / generateRecap
│   ├── prompts.ts           — RANKER_INSTRUCTIONS + every buildXxxPrompt/buildXxxSystemPrompt
│   └── types.ts             — AgentEvent, AgentResult (signal: 'high'|'low'|'error'), …
│
└── lib/ai/
    ├── provider.ts          — shared getGoogleProvider + LanguageModel type alias
    └── middleware.ts        — guardrailMiddleware + timeoutSignal for generateText/Object

Supabase Edge Functions (Deno)
├── github-webhook           — push/PR/release → pre-filter → fetchCommitContext → ranker → draft
├── generate-post            — handleGenerate / handleRegenerate / handleXhsCopy, all proxy to Vercel
├── generate-recap           — weekly / branch recap (proxies to /api/agent/recap)
├── connect-repo             — connect/disconnect repos + generate intro post
├── backfill-context         — one-shot to populate project_context + intro posts for existing repos
├── stripe-webhook           — subscription lifecycle events
├── create-post              — manual post with limit checks
├── publish-post             — publish to Twitter/LinkedIn/Bluesky
├── billing                  — Stripe checkout + portal sessions
├── social-auth              — Twitter/LinkedIn OAuth + Bluesky credentials
├── social-disconnect        — disconnect platforms
├── github-app               — GitHub App installation + repo listing
└── _shared/
    ├── vercel-ai.ts         — single seam: callVercelAi<T>(path, body) → posts to /api/agent/*
    ├── github.ts            — installation token + fetchCommitContext/fetchPrContext/fetchTagContext/fetchRepoRecapData
    ├── auth.ts              — requireUser; functions that self-auth have verify_jwt=false in config.toml
    └── crypto / cors / logger / publish / subscription / notify / email / http / oauth-refresh
```

## Stack

- Next.js 16 + App Router + Turbopack
- Supabase (auth + Postgres + Edge Functions)
- AI SDK + @ai-sdk/google for all generation (Vercel Functions, Node.js runtime)
- Gemini (via `gemini-3-flash-preview` by default for ranker + content)
- shadcn/ui + Geist / Space Grotesk / IBM Plex Mono fonts
- Bauhaus-flavored dark UI (`--radius: 0`, neo-* color tokens, hard-shadow buttons)
- Dark mode by default

## Ranker (not gatekeeper)

The agent is a **ranker**, not a gatekeeper:
- Every webhook event (that survives the cheap pre-filter) produces a draft.
- The ranker returns `signal: 'high' | 'low'` + an angle. Never skips.
- Dashboard shows high-signal drafts by default; low-signal collapses under a "Low priority" disclosure with the AI's reasoning.
- `post_decisions.decision` column stores signal values (`high` / `low` / `error`); the CHECK constraint also permits legacy `post` / `skip` / `bundle_later` for historical rows.
- Pre-filter in `github-webhook/index.ts:preFilterPush` drops merge commits, lockfile-only, CI-only, and `docs|chore|style|build|ci|test` prefixes with only docs/tooling files — zero AI cost.

## Conventions

- Dashboard pages are `'use client'` with SWR hooks from `lib/hooks/use-dashboard-data.ts`.
- SWR hooks use conditional keys with userId from AuthContext: `userId ? ['key', userId] : null`.
- Dashboard page pattern: page.tsx calls the hook, handles loading/error, passes data as props to `*-client.tsx`.
- After any user mutation (connect, toggle, delete, regenerate, …), call `useSWRConfig().mutate(<predicate>)` to invalidate the relevant cache keys (`repos-data`, `posts-data`, `dashboard-data`, `settings-data`, `draft-count`, `streak`). Don't rely on `router.refresh()` — these pages are CSR.
- Landing/auth pages and `/changelog/*` are Server Components using `createServerSupabaseClient()`.
- Interactive logic lives in `*-client.tsx` (e.g. `posts-client.tsx`, `settings-client.tsx`, `repo-list.tsx`).
- `proxy.ts` handles auth redirects — matcher covers every protected path explicitly (not just `/dashboard/*`), because the `(dashboard)` route group doesn't prefix URLs.
- AuthProvider exposes `session`, `userId`, `loading` via React context.
- DB writes / external API calls go through Edge Functions via `supabase.functions.invoke()` (or `callEdgeFunction` in `lib/edge-function.ts` for path-routed functions).
- Edge Function shared utilities live in `supabase/functions/_shared/`.
- All AI generation goes through Vercel `/api/agent/*`. Edge functions never call Gemini directly — they proxy through `_shared/vercel-ai.ts`.
- Agent modules live in `lib/agent/` — `orchestrator.ts` (ranker pipeline), `generators.ts` (each generator flavour), `prompts.ts` (all prompts), `types.ts`.
- Agent API authenticates via `x-agent-secret` header; server side verifies with `timingSafeEqual` in `app/api/agent/_auth.ts:verifyAgentSecret`.
- `lib/supabase/admin.ts` provides a service-role client for API routes (bypasses RLS).
- Edge fns that self-authenticate with `requireUser` need `verify_jwt = false` in `supabase/config.toml`; otherwise Supabase platform rejects requests before they reach the code. New fns must be added there.
- Platform character limits in `lib/platforms.ts`; X Premium support via `profiles.x_premium`.
- `profiles.public_changelog` (default true) controls whether a user shows up on the public `/changelog` directory and landing's featured section.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
