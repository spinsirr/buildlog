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

**Middleware Auth + Client-Side Dashboard + Agentic AI Layer + Supabase Edge Functions**

```
Vercel (Next.js 16)
├── proxy.ts — auth redirects (dashboard → login, login → dashboard)
├── Dashboard pages — 'use client' with SWR hooks for data fetching
│   ├── AuthProvider — client-side session context (exposes userId)
│   ├── SWR hooks — lib/hooks/use-dashboard-data.ts (conditional keys with userId)
│   └── Loading/error — skeleton → content, FetchError with retry
├── Landing/auth pages — Server Components with server-side Supabase client
├── Client Components — interactive leaves (buttons, forms, modals)
│
├── app/api/agent/decide/ — Agentic decision + generation (Vercel Function)
│   └── route.ts — Forwards to runAgentSafe, returns structured decision
│
├── lib/agent/ — Agent layer modules
│   ├── orchestrator.ts — ToolLoopAgent with 3 tools (context, posts, generation)
│   ├── prompts.ts      — System prompts, content templates, event formatting
│   └── types.ts        — AgentEvent, AgentResult, shared types

Supabase Edge Functions (Deno runtime)
├── github-webhook — GitHub push/PR/release → calls agent API or direct Gemini
├── stripe-webhook — subscription lifecycle events
├── generate-post — AI content generation (Gemini API, used for manual/legacy)
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
- AI SDK + @ai-sdk/google (Vercel Functions, Node.js runtime)
- Gemini (agent reasoning + decision + content generation via ToolLoopAgent)
- Gemini (legacy content generation via direct fetch in Edge Functions)
- shadcn/ui + Geist
- Dark mode by default

## Conventions

- Dashboard pages are `'use client'` with SWR hooks from `lib/hooks/use-dashboard-data.ts`
- SWR hooks use conditional keys with userId from AuthContext: `userId ? ['key', userId] : null`
- Dashboard page pattern: page.tsx calls hook, handles loading/error, passes data as props to *-client.tsx
- Landing/auth pages are Server Components that fetch via `createServerSupabaseClient()`
- Interactive logic lives in `*-client.tsx` components (e.g. `posts-client.tsx`, `settings-client.tsx`)
- proxy.ts handles auth redirects (dashboard → login for unauthed, login → dashboard for authed)
- AuthProvider exposes `session`, `userId`, and `loading` via React context
- DB writes / external API calls go through Edge Functions via `supabase.functions.invoke()`
- For Edge Functions with path routing, use raw `fetch()` to `NEXT_PUBLIC_SUPABASE_URL/functions/v1/<name>/<path>`
- Edge Function shared utilities live in `supabase/functions/_shared/`
- API routes exist only under `app/api/agent/` for the agentic AI layer (Node.js runtime required)
- Agent modules live in `lib/agent/` — orchestrator (ToolLoopAgent), prompts, types
- Agent API authenticates via `x-agent-secret` header (AGENT_API_SECRET env var)
- `lib/supabase/admin.ts` provides service-role client for API routes (bypasses RLS)
- Ranker history in `post_decisions` table with reasoning traces (decision column stores signal: `high`/`low`/`error`)
- Platform character limits in `lib/platforms.ts`, X Premium support via `profiles.x_premium`

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
