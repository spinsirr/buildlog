# Remove 'use client' — Server Components Migration

## Goal
Remove `output: "export"` and convert all dashboard pages from full `'use client'` to Server Components.
Push `'use client'` down to only interactive leaf components (buttons, forms, toggles).

## Step 1: Infrastructure

### 1a. Remove `output: "export"` from `next.config.ts`

### 1b. Create `lib/supabase/server.ts`
Server-side Supabase client using `createServerClient` from `@supabase/ssr` with `cookies()`.
Next.js 16: `cookies()` is async — `await cookies()`.

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try { cookieStore.set(name, value, options) } catch {}
          })
        },
      },
    }
  )
}
```

### 1c. Create `proxy.ts` at project root (same level as `app/`)
Auth guard — redirect unauthenticated users from `/dashboard/*` to `/login`.

```ts
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => cookies.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        }),
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  
  if (request.nextUrl.pathname.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (request.nextUrl.pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  return response
}

export const config = { matcher: ['/dashboard/:path*', '/login'] }
```

### 1d. Remove `AuthGuard` from dashboard layout
Layout becomes a pure Server Component (it already is one, just wraps AuthGuard).

## Step 2: Convert Pages (easiest first)

### 2a. `usage/page.tsx` → Full Server Component
- ZERO interaction, pure display
- Make it `async`, call `createServerSupabaseClient()`, fetch data directly
- Remove `'use client'`, remove SWR
- `UsageBar` is a pure component — no state needed, keep inline

### 2b. `dashboard/page.tsx` → Server Component + client leaves
- Server Component: fetch stats, posts, connections
- Extract `DashboardActions` client component (delete button, router.push for edit)
- Keep stat cards, onboarding, table as server-rendered

### 2c. `repos/page.tsx` → Server Component + client leaves  
- Server Component: fetch repo list via Edge Function
- Extract `RepoList` client component (toggle needs state + mutation)
- Actually: the toggle calls supabase.functions.invoke — needs client. So extract `RepoList` as a client component that receives initial data as props.

### 2d. `settings/page.tsx` → Server Component + client leaves
- Server Component: fetch connections + profile
- Extract: `PlatformConnections` (OAuth flow, state), `ToneSelector` (state), `AutoPublishToggle`, `EmailNotificationsToggle`
- These are all interactive — extract as client components receiving initial data as props

### 2e. `posts/page.tsx` → Server Component + client leaves
- Server Component: fetch posts + connections
- Extract: `PostsList` client component (tabs, editing, publishing, creating — ALL interactive)
- This page is ~90% interactive, so the Server Component just does the initial fetch and passes data down

### 2f. `login/page.tsx` — KEEP `'use client'`
- OAuth buttons need browser APIs (`window.location.origin`)
- Auth check can move to proxy.ts (done in Step 1c)
- Remove the `useEffect` auth check (proxy handles redirect now)
- Still needs `'use client'` for onClick handlers

### 2g. `auth/callback/page.tsx` — KEEP `'use client'`
- Needs `useRouter`, `useEffect` for client-side auth exchange
- This is inherently a client-side operation

## Step 3: Cleanup
- Remove unused `fetchDashboard`, `fetchUsage`, etc. SWR fetchers from pages that are now Server Components
- Keep `lib/supabase/client.ts` for client components that still need it
- Update `auth-guard.tsx` — remove or simplify (proxy.ts now handles auth redirect)
- Build and verify: `bun run build`

## Rules
- Every file you modify: commit with a descriptive message
- DO NOT break the build — verify with `bun run build` after each major change
- Keep the existing UI exactly the same — this is a pure architecture refactoring
- For pages where most of the content is interactive (posts, settings), it's OK to have a thin Server Component wrapper that just fetches initial data and passes it to a `'use client'` child
