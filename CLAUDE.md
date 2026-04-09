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

**Server Components + Agentic AI Layer + Supabase Edge Functions**

```
Vercel (Next.js 16)
├── Server Components — pages fetch data via server-side Supabase client
├── Dashboard layout — server-side auth check (redirect if not logged in)
├── Client Components — only for interactive leaves (buttons, forms, modals)
├── proxy.ts — redirects unauthed users from /dashboard to /login
│
├── app/api/agent/decide/ — Agentic decision + generation (Vercel Function)
│   └── route.ts — ToolLoopAgent with Claude reasoning + Gemini generation
│
├── lib/agent/ — Agent layer modules
│   ├── orchestrator.ts — ToolLoopAgent with tools (decision, generation, memory)
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
- AI SDK + @ai-sdk/anthropic + @ai-sdk/google (Vercel Functions, Node.js runtime)
- Claude (agent reasoning + decision via ToolLoopAgent)
- Gemini (content generation — via AI SDK in agent, direct fetch in legacy Edge Functions)
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
- proxy.ts handles auth redirects (dashboard → login for unauthed, login → dashboard for authed)
- No middleware
- API routes exist only under `app/api/agent/` for the agentic AI layer (Node.js runtime required)
- Agent modules live in `lib/agent/` — orchestrator (ToolLoopAgent), prompts, types
- Agent API authenticates via `x-agent-secret` header (AGENT_API_SECRET env var)
- `lib/supabase/admin.ts` provides service-role client for API routes (bypasses RLS)
- Agent memory stored in `agent_memory` table — durable product context per repo
- Decision history in `post_decisions` table with reasoning traces

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
