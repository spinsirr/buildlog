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

## Stack

- Next.js 16 + App Router + Turbopack
- Supabase (auth + Postgres)
- Vercel AI SDK v6 + AI Gateway
- AI Elements for rendering AI text
- shadcn/ui + Geist

## Conventions

- Default to Server Components; add `'use client'` only when needed
- All request APIs are async: `await cookies()`, `await headers()`, `await params`
- Use `proxy.ts` (not `middleware.ts`) for route protection
- Never render AI text as raw `{text}` — use AI Elements `<MessageResponse>`
- Dark mode by default
