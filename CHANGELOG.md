# Changelog

All notable changes to this project will be documented in this file.

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
