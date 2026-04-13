# TODOS

## SWR prefetch on sidebar hover
**What:** Add SWR `preload()` calls on sidebar link hover to pre-fetch page data before click.
**Why:** After SSR→CSR migration, every page navigation shows a skeleton flash (~200-500ms) while SWR fetches data. Prefetching on hover eliminates this for warm navigations.
**Pros:** Near-instant page transitions, better perceived performance.
**Cons:** Extra network requests on hover (most will be wasted if user doesn't click). Minimal cost since Supabase queries are fast.
**Context:** Dashboard pages migrated from Server Components to client-side SWR fetching in commit 960920e. Each page uses a dedicated SWR hook from `lib/hooks/use-dashboard-data.ts`. SWR's `preload(key, fetcher)` can fire the fetch before the component mounts.
**Depends on:** SWR collision fix (Issue 2 from eng review) must be resolved first so each page has a single canonical SWR key/fetcher pair.

## Cross-page SWR cache sharing
**What:** Reduce redundant Supabase queries when navigating between dashboard pages that query overlapping tables.
**Why:** `fetchDashboardData` queries posts (limit 5) and `fetchPostsData` queries posts (no limit). Navigating dashboard→posts re-fetches posts from scratch. Same pattern for repos and platform_connections.
**Pros:** Fewer Supabase queries, faster cross-page navigation, lower bandwidth.
**Cons:** Adds complexity to the data layer. SWR doesn't natively support partial cache sharing across keys.
**Context:** Could use SWR middleware, a normalized cache layer, or restructure hooks to share a base query. Becomes more important as user base grows.
**Depends on:** Nothing blocking, but should be done after the current eng review fixes ship.
