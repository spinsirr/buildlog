# BuildLog Refactor Plan — All 15 Issues

## Critical Bugs
- [ ] #1 Plan limits mismatch — `plans.ts` free=10, `usage/page.tsx` hardcodes 20. Align to plans.ts as source of truth.
- [ ] #2 React hooks after early return in `dashboard/page.tsx` — move all hooks above conditional returns
- [ ] #8 Mobile nav missing Usage page — add to mobile nav

## Deduplication — Utilities
- [ ] #9 Platform config in 3 places → create `lib/platforms.ts` single source of truth
- [ ] #10 timeAgo duplicated → consolidate into `lib/utils.ts`
- [ ] #11 callGemini/callGeminiLong → single function with options param

## Deduplication — Components
- [ ] #4 ErrorState copy-pasted 10x → create `components/error-state.tsx`
- [ ] #5 Skeleton duplicated → shared skeleton components
- [ ] #7 Streak calc duplicated → `lib/streak.ts`

## Backend
- [ ] #3 Publish logic duplicated → `_shared/publish.ts`
- [ ] #12 Module-level createClient() → lazy/function-scoped
- [ ] #13 Edge Function fetch → `lib/api.ts` helper
- [ ] #15 social-auth cleanup

## Big Refactors
- [ ] #6 Dashboard 300-line god-component → split
- [ ] #14 posts-client.tsx 880 lines → split
