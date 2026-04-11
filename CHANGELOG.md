# Changelog

All notable changes to this project will be documented in this file.

## [0.0.1.0] - 2026-04-11

### Added
- X Premium support: users can toggle X Premium in settings to unlock 4,000-character posts instead of 280
- `bundle_later` decision type: agent can defer events that are meaningful but not yet story-ready
- Multi-platform character limit: UI enforces the tightest limit across all connected platforms
- `getEffectiveLimit()` and `getContentLimit()` utilities in `lib/platforms.ts`
- `x_premium` column on profiles table (migration included)
- Agent test harness with mock model, mock tools, fixture events, and evaluator
- Harness scenarios for post, skip, bundle_later, and error paths
- `bun run harness` and `bun run harness:live` scripts

### Changed
- Agent now uses 3 focused tools (get_repo_context, get_recent_posts, generate_content) instead of 5
- Agent tool validation strictly requires `generate_content` for post decisions
- Decision prompts favor `bundle_later` over `skip` for meaningful but incomplete work
- Content generation accepts dynamic `contentBudget` parameter across all paths (agent, Edge Function, Node-side)
- Removed watermark suffix from generated posts

### Fixed
- Removed broken Deno-module fallback from Node.js Vercel Function route
- Edge Function `generatePost` no longer hardcodes 280-char limit for X Premium users
- Legacy webhook fallback now passes correct character budget based on user's X Premium setting

### Removed
- `WATERMARK` constant and watermark appending logic
- `get_product_context`, `get_decision_history`, and `update_product_memory` agent tools
