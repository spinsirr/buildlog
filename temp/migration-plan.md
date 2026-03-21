# BuildLog Migration: Full-Stack → Pure SPA + Supabase Edge Functions

## Goal
Convert buildlog to: **Pure SPA on Vercel** (`output: "export"`, all client components) + **Supabase Edge Functions** (all backend logic)

## Architecture

```
Browser → Vercel (static CDN only)
           └── Client-only React (Next.js static export)
                ├── supabase.from('...') → DB direct (RLS enforced)
                └── supabase.functions.invoke() → Edge Functions

Supabase Edge Functions (Deno runtime)
  ├── publish-post — publish to Twitter/LinkedIn/Bluesky
  ├── generate-post — AI content generation (Gemini via fetch)
  ├── create-post — post creation with limit enforcement
  ├── github-webhook — GitHub push/PR/release → auto-generate posts
  ├── stripe-webhook — subscription lifecycle events
  ├── billing — checkout session + portal session creation
  ├── social-auth — Twitter/LinkedIn OAuth initiate + callback, Bluesky connect
  ├── social-disconnect — disconnect any platform
  ├── github-app — GitHub app installation callback
  └── connect-repo — connect a repository

Supabase Postgres (RLS policies)
  ├── posts: SELECT/UPDATE(content)/DELETE — user's own rows
  ├── connected_repos: SELECT — user's own rows
  ├── platform_connections: SELECT — user's own rows
  ├── notifications: SELECT/UPDATE(read) — user's own rows
  └── profiles: SELECT/UPDATE — user's own row
```

**No server-side code on Vercel** — `output: "export"` static export. Auth check is client-side (Supabase onAuthStateChange). No proxy.ts, no Server Components, no Server Actions.

## What Changes

### Routes → Direct Client Queries (kill the API route, use Supabase client + RLS)
- `GET /api/dashboard` → client queries posts, repos, connections, calculates streak
- `GET /api/posts` → `supabase.from('posts').select('*, connected_repos(full_name)')`
- `DELETE /api/posts/[id]` → `supabase.from('posts').delete().eq('id', id)`
- `PATCH /api/posts/[id]` (content edit only) → `supabase.from('posts').update({content})`
- `GET /api/repos` → `supabase.from('connected_repos').select('*')`
- `GET /api/notifications` → direct query + client-side unread count
- `PATCH /api/notifications` → `supabase.from('notifications').update({read: true})`
- `GET /api/settings/connections` → direct query platform_connections
- `GET/PATCH /api/settings/profile` → direct query/update profiles
- `GET /api/usage` → direct queries with client-side aggregation
- `POST /api/auth/logout` → `supabase.auth.signOut()` client-side

### Routes → Edge Functions
- `POST /api/posts` → `create-post` (enforces monthly limit)
- `POST /api/posts/generate` → `generate-post` (AI + limit check)
- `POST /api/posts/[id]/regenerate` → `generate-post` (same function, different param)
- `PATCH /api/posts/[id]` (publish action) → `publish-post`
- `POST /api/webhooks/github` → `github-webhook`
- `POST /api/webhooks/stripe` → `stripe-webhook`
- `POST /api/billing/checkout` → `billing`
- `POST /api/billing/portal` → `billing`
- `POST /api/auth/twitter` → `social-auth` (OAuth initiate)
- `GET /api/auth/twitter/callback` → `social-auth` (OAuth callback)
- `POST /api/auth/twitter/disconnect` → `social-disconnect`
- `POST /api/auth/linkedin` → `social-auth`
- `GET /api/auth/linkedin/callback` → `social-auth`
- `POST /api/auth/linkedin/disconnect` → `social-disconnect`
- `POST /api/auth/bluesky` → `social-auth`
- `POST /api/auth/bluesky/disconnect` → `social-disconnect`
- `GET /api/auth/github` → handled by Supabase Auth (already is)
- `GET /api/auth/google` → handled by Supabase Auth
- `POST /api/auth/twitter-login` → check what this does
- `GET /api/github-app/callback` → `github-app`
- `POST /api/repos/connect` → `connect-repo`

### Frontend Changes
1. **All pages → client components** with `'use client'` — no server components
2. **Auth guard** → client-side: `useEffect` + `supabase.auth.onAuthStateChange()` → redirect to /login if unauthenticated
3. **SWR fetchers** → replace `/api/*` calls with direct Supabase queries or `supabase.functions.invoke()`
4. **Logout** → `supabase.auth.signOut()` + router.push('/login')
5. **next.config.ts** → add `output: "export"`, remove any server-only config
6. **Remove** `lib/supabase/server.ts` — no server-side Supabase usage
7. **Remove** all `app/api/` routes
8. **Remove** `proxy.ts` / `middleware.ts` if exists
9. **Dashboard layout** → client component with auth guard wrapper
10. **Login page** → keep as-is (already client component with Supabase Auth UI)

### Auth Guard Pattern
Create a reusable auth guard component:
```tsx
// components/auth-guard.tsx
'use client'
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/login')
      else setUser(data.user)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) router.replace('/login')
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <LoadingSpinner />
  if (!user) return null
  return children
}
```

### Database Changes
- Verify RLS policies exist for: posts, connected_repos, platform_connections, notifications, profiles
- Add RLS policy for posts UPDATE (content only, not status/published fields?)
- Add DB function for post limit enforcement (optional, Edge Function handles it)

### Shared Libs to Port to Deno
- `lib/crypto.ts` → Deno has `node:crypto`, should work as-is
- `lib/twitter.ts` → pure fetch, works in Deno
- `lib/linkedin.ts` → pure fetch, works in Deno
- `lib/bluesky.ts` → pure fetch, works in Deno
- `lib/ai/generate-post.ts` → replace `ai` SDK with direct Gemini API fetch
- `lib/plans.ts` → plain object, copy as-is
- `lib/subscription.ts` → rewrite for service client in Deno
- `lib/notify.ts` → rewrite, uses service client + Resend
- `lib/email.ts` → rewrite for Resend API fetch
- `lib/rate-limit.ts` → not needed (Supabase has its own rate limiting)

### OAuth Flow Changes
OAuth callbacks currently redirect back to `/api/auth/*/callback` on the same domain. After migration, callbacks go to Supabase Edge Function URLs.

The current code already stores OAuth tokens in DB and redirects to `/settings?connected=twitter`. Only the callback URL changes to the Edge Function URL. No cookies needed.

## Execution Order

### Phase 1: Supabase Setup
- [ ] Create `supabase/functions/` directory structure
- [ ] Verify/add RLS policies for all tables
- [ ] Create shared lib directory for Edge Functions (`supabase/functions/_shared/`)

### Phase 2: Edge Functions (backend) — write ALL before touching frontend
- [ ] `github-webhook` — port webhook handler + AI generation + publishing
- [ ] `stripe-webhook` — port Stripe webhook handler
- [ ] `generate-post` — port AI generation (Gemini API direct)
- [ ] `create-post` — post creation with limit check
- [ ] `publish-post` — port social publishing logic
- [ ] `billing` — Stripe checkout + portal
- [ ] `social-auth` — Twitter + LinkedIn OAuth flows + Bluesky
- [ ] `social-disconnect` — disconnect platforms
- [ ] `github-app` — GitHub app callback
- [ ] `connect-repo` — repo connection

### Phase 3: Frontend Migration
- [ ] Create `AuthGuard` component
- [ ] Create `lib/supabase/functions.ts` helper for `supabase.functions.invoke()`
- [ ] Add `output: "export"` to next.config.ts
- [ ] Convert dashboard layout to client component with AuthGuard
- [ ] Replace SWR fetchers: reads → direct Supabase, writes → Edge Functions
- [ ] Client-side logout
- [ ] Update all OAuth flow initiation to use Edge Function URLs

### Phase 4: Cleanup + Deploy
- [ ] Remove all `app/api/` routes
- [ ] Remove `proxy.ts` / `middleware.ts` if exists
- [ ] Remove `lib/supabase/server.ts`
- [ ] Remove unused server-only deps
- [ ] Update OAuth redirect URIs in Twitter/LinkedIn developer portals
- [ ] Update GitHub webhook URL
- [ ] Update Stripe webhook URL
- [ ] Deploy Edge Functions: `supabase functions deploy`
- [ ] Update CLAUDE.md to reflect new architecture
- [ ] Test full flow

## Env Vars for Edge Functions
Edge Functions need these secrets (set via `supabase secrets set`):
- `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`
- `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
- `TOKEN_ENCRYPTION_KEY`
- `GITHUB_WEBHOOK_SECRET`
- `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_PRICE_ID`
- `RESEND_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY` (for Gemini direct API)
- `FRONTEND_URL` (for OAuth redirects back to frontend)
