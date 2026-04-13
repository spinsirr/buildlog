# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0.0] - 2026-04-13

### Added
- Public `/changelog` directory page listing every user's build-in-public timeline, sorted by most recent activity, with SEO-friendly `CollectionPage` + `ItemList` JSON-LD
- "In the wild" featured changelogs section on the landing page for social proof + internal linking
- Changelogs link in landing nav (desktop + mobile) and every marketing footer
- Settings toggle to opt out of the public directory (URL stays accessible either way)
- `docs/SEO.md` long-term SEO guide with prioritized roadmap (dynamic sitemap done, HowTo / Product schema / llms.txt next)
- Bauhaus visual alignment for the dashboard: logo mark, font-display headings, neo color palette, directional sidebar active indicator, geometric corner accents on focus card
- XHS-style copy generator with bilingual modal picker (English for Twitter/LinkedIn, 中文 for 小红书)
- Real code diffs for commit events: new `fetchCommitContext` uses GitHub compare API so the AI reads actual code changes, not just commit messages
- Pre-filter layer on push webhook: merge commits, lockfile-only, CI-only, and docs+chore pushes are dropped before any AI call (zero token cost)
- Low-signal drafts disclosure in Posts: AI-rated noise collapses under a "Low priority" section with AI reasoning shown for each

### Changed
- Decision layer rewritten from gatekeeper (ToolLoopAgent skip/bundle_later/post) to ranker (two-phase: rankEvent + generateContent). Every event always creates a draft with a `signal: 'high' | 'low'` label. Per-push tokens: ~24k → ~6k (-75%)
- Decision layer now on by default for all profiles
- Dashboard `--radius: 0` — all shadcn cards, buttons, inputs, tabs, badges are square; only avatars and intentionally circular decorations keep `rounded-full`
- Dynamic sitemap includes all opt-in changelog pages with latest `published_at` as `lastModified`
- Landing page converted to async Server Component to embed featured changelogs
- XHS button flow: click opens modal with language picker (no generation until user chooses), then renders the result with lang-aware copy
- Posts UI splits drafts by signal; manual posts and legacy drafts default to the high-signal group

### Removed
- Deno-side AI duplication: `supabase/functions/_shared/ai.ts` (618 lines), `_shared/decision.ts`, `ai-sdk-spike/` — all prompts consolidated in `lib/agent/prompts.ts`
- Orphan Vercel routes: `app/api/ai/decide`, `app/api/ai/generate`, `app/api/ai/process`, `app/api/ai/_auth.ts`
- Orphan modules: `lib/ai/engine.ts`, `lib/ai/decision.ts`, `lib/ai/generate.ts`, `lib/ai/context.ts`, `lib/ai/prompts.ts`, `lib/ai/schemas.ts`
- "Quick idea" sidebar input (unused, deleted `components/quick-capture.tsx`)
- Legacy purple accent across dashboard (every `purple-*` class replaced with neo-brutalism tokens)

### Fixed
- `post_decisions.decision` CHECK constraint widened to accept ranker signal values (`high` / `low` / `error`) alongside legacy gatekeeper values
- `AGENT_API_SECRET` comparison on all `/api/agent/*` routes now uses `timingSafeEqual` (no timing-attack surface)
- Duplicate `20260405100000` migration timestamps resolved (`agent_memory` → `20260405100001`)
- Dead ternary in posts step indicator (`step === 'write' ? bg-neo-accent : bg-neo-accent`)

### Infrastructure
- New Vercel routes: `/api/agent/{generate,xhs,intro,recap}` — all AI generation flows through Vercel with the AI SDK + guardrail middleware
- Deno edge functions (`github-webhook`, `generate-post`, `generate-recap`, `connect-repo`, `backfill-context`) now proxy through `_shared/vercel-ai.ts`
- Shared AI provider/model type factored into `lib/ai/provider.ts`
- Public changelog opt-out via new `profiles.public_changelog boolean default true` column + partial index
- Bauhaus tokens in `app/globals.css`: `--radius: 0`, neo palette, card/button hard-shadow utilities

## [0.0.4.0] - 2026-04-12

### Changed
- Repos page now shows only connected repos with a searchable modal to connect new ones
- Billing checkout resolves Stripe price by `pro_monthly` lookup key instead of env var
- `ensureCustomer` extracted as shared helper with proper error handling and stale customer recovery
- Portal endpoint returns 404 for users with no billing account instead of creating empty customers
- `sanitizeReturnUrl` and `getAllowedReturnOrigins` moved to `_shared/http.ts` for reuse across Edge Functions

### Fixed
- Open redirect in billing endpoint: `return_url` from request body is now validated against origin allowlist
- Internal Stripe error details no longer leaked in billing error responses
- `ensureCustomer` now checks for Supabase errors on both profile fetch and customer ID persistence
- Stripe SDK switched from `esm.sh/stripe@20` to `npm:stripe@18` for reliable Deno compatibility

### Removed
- Unused `stripe` npm dependency from Next.js package.json (only used in Deno Edge Functions via `npm:` specifier)

## [0.0.3.0] - 2026-04-11

### Added
- Recap v2: GitHub API as primary data source — recaps now pull commits, merged PRs, and releases directly from connected repos
- Branch-based recap: generate a post summarizing a specific feature branch's activity
- Recap dropdown menu: "Weekly Recap" and "From Branch..." options on the posts dashboard
- Branch picker dialog: select repo + branch to generate a targeted recap
- 4 new GitHub fetch helpers: `fetchRecentCommits`, `fetchMergedPrs`, `fetchRecentReleases`, `fetchRepoRecapData`
- Examples page redesign: platform tab switcher (Twitter/LinkedIn/Bluesky), weekly recap and branch recap examples
- 15 new unit tests for v2 prompt builders (28 total recap tests)

### Changed
- Recap prompts are now mode-aware (`week` vs `branch`) with different framing
- Examples page cards show one platform at a time instead of side-by-side split

## [0.0.2.0] - 2026-04-11

### Added
- Weekly Recap: generate a recap draft from your week's bundled events and published posts
- "Weekly Recap" button on the posts dashboard
- `generate-recap` Edge Function aggregates bundle_later decisions + published posts into one recap
- `generateWithRetry` shared helper for Gemini calls with retry/truncation logic
- 13 unit tests for recap prompt builders
- Deduplication: only one recap per week (Monday-aligned)

## [0.0.1.0] - 2026-04-11

### Added
- X Premium support: toggle in settings to write posts up to 4,000 characters instead of 280
- Smart bundling: agent can defer events that aren't story-ready yet, saving them for a stronger post later
- Multi-platform awareness: character limits now respect every connected platform, not just Twitter
- Platform character limit utilities (`getContentLimit`, `getEffectiveLimit`)
- `x_premium` column on profiles table (migration included)
- Agent test harness with mock model, fixture events, evaluator, and `bun run harness` scripts

### Changed
- Agent simplified from 5 tools to 3 focused tools (context, recent posts, content generation)
- Agent now verifies content was actually generated before allowing a "post" decision
- Decision engine favors bundling over skipping for meaningful but incomplete work
- Character limits are now dynamic across all generation paths, not hardcoded to 280
- Posts no longer include the "buildlog.ink" watermark suffix

### Fixed
- Removed broken Deno-module fallback from Node.js Vercel Function route
- Edge Function `generatePost` no longer hardcodes 280-char limit for X Premium users
- Legacy webhook fallback now passes correct character budget based on user's X Premium setting

### Removed
- `WATERMARK` constant and watermark appending logic
- `get_product_context`, `get_decision_history`, and `update_product_memory` agent tools
