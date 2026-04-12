# Changelog

All notable changes to this project will be documented in this file.

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
