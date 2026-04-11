import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PLANS } from '@/lib/plans'
import { platformLabels } from '@/lib/platforms'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

const sourceLabels: Record<string, string> = {
  commit: 'Commits',
  pr: 'Pull Requests',
  release: 'Releases',
  manual: 'Manual',
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const isUnlimited = !Number.isFinite(limit)
  const pct = isUnlimited ? 0 : Math.min((used / limit) * 100, 100)
  const isNearLimit = !isUnlimited && pct >= 80
  const isAtLimit = !isUnlimited && used >= limit

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-300">{label}</span>
        <span
          className={cn(
            'text-sm font-mono',
            isAtLimit ? 'text-red-400' : isNearLimit ? 'text-amber-400' : 'text-zinc-400'
          )}
        >
          {used}
          {isUnlimited ? '' : ` / ${limit}`}
          {isUnlimited && <span className="text-zinc-500 ml-1">unlimited</span>}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-purple-500'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default async function UsagePage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: sub, error: subError } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (subError) {
    console.error('Failed to load subscription:', subError.message)
  }

  const plan = sub?.status === 'active' ? 'pro' : 'free'
  const limits = PLANS[plan]

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [{ data: allPosts }, { count: repoCount }, { count: platformCount }] = await Promise.all([
    supabase
      .from('posts')
      .select('status, source_type, platforms, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('connected_repos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true),
    supabase
      .from('platform_connections')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ])

  const posts = (allPosts ?? []) as {
    status: string
    source_type: string
    platforms: string[] | null
    created_at: string
  }[]
  const publishedPosts = posts.filter((p) => p.status === 'published')
  const draftPosts = posts.filter((p) => p.status === 'draft')
  const postsThisMonth = posts.filter((p) => p.created_at >= monthStart)

  const platformCounts: Record<string, number> = {}
  for (const post of publishedPosts) {
    for (const p of (post.platforms as string[]) ?? []) {
      platformCounts[p] = (platformCounts[p] ?? 0) + 1
    }
  }

  const sourceCounts: Record<string, number> = {}
  for (const post of posts.slice(0, 30)) {
    sourceCounts[post.source_type] = (sourceCounts[post.source_type] ?? 0) + 1
  }

  const usage = {
    posts_this_month: postsThisMonth.length,
    total_posts: posts.length,
    published_posts: publishedPosts.length,
    draft_posts: draftPosts.length,
    repos: repoCount ?? 0,
    platforms: platformCount ?? 0,
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-50">Usage</h1>
        <Badge
          className={cn(
            'text-xs',
            plan === 'pro'
              ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
              : 'bg-zinc-800 text-zinc-400 border-0'
          )}
        >
          {plan === 'pro' ? 'Pro' : 'Free'} plan
        </Badge>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-zinc-50 text-base">Plan Limits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <UsageBar
            label="Posts this month"
            used={usage.posts_this_month}
            limit={limits.posts_per_month}
          />
          <UsageBar label="Connected repos" used={usage.repos} limit={limits.repos} />
          <UsageBar label="Connected platforms" used={usage.platforms} limit={limits.platforms} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold text-zinc-50 tabular-nums">
            {usage.total_posts}
          </span>
          <span className="text-xs text-zinc-500 font-mono-ui">total</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-medium text-zinc-300 tabular-nums">
            {usage.published_posts}
          </span>
          <span className="text-xs text-zinc-500 font-mono-ui">published</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-medium text-zinc-300 tabular-nums">
            {usage.draft_posts}
          </span>
          <span className="text-xs text-zinc-500 font-mono-ui">drafts</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-medium text-zinc-300 tabular-nums">
            {usage.posts_this_month}
          </span>
          <span className="text-xs text-zinc-500 font-mono-ui">this month</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-zinc-50 text-base">By Platform</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(platformCounts).length === 0 ? (
              <p className="text-sm text-zinc-500 py-4 text-center">No published posts yet</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(platformCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([platform, count]) => {
                    const total = usage.published_posts || 1
                    const pct = Math.round((count / total) * 100)
                    return (
                      <div key={platform} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-zinc-300">
                            {platformLabels[platform] ?? platform}
                          </span>
                          <span className="text-xs text-zinc-400 font-mono">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-purple-500/70"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-zinc-50 text-base">By Source</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(sourceCounts).length === 0 ? (
              <p className="text-sm text-zinc-500 py-4 text-center">No posts yet</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(sourceCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([source, count]) => {
                    const total = Object.values(sourceCounts).reduce((a, b) => a + b, 0)
                    const pct = Math.round((count / total) * 100)
                    return (
                      <div key={source} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-zinc-300">
                            {sourceLabels[source] ?? source}
                          </span>
                          <span className="text-xs text-zinc-400 font-mono">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-purple-500/70"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
