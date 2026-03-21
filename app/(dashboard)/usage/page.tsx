import type { Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Usage' }
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const platformLabels: Record<string, string> = {
  twitter: 'X',
  linkedin: 'LinkedIn',
  bluesky: 'Bluesky',
}

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
        <span className={cn(
          'text-sm font-mono',
          isAtLimit ? 'text-red-400' : isNearLimit ? 'text-amber-400' : 'text-zinc-400'
        )}>
          {used}{isUnlimited ? '' : ` / ${limit}`}
          {isUnlimited && <span className="text-zinc-600 ml-1">unlimited</span>}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-indigo-500'
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

  // Check plan
  const { data: sub, error: subError } = await supabase
    .from('subscriptions')
    .select('status')
    .single()

  if (subError && subError.code !== 'PGRST116') {
    console.error('Failed to load subscription:', subError.message)
  }

  const plan = sub?.status === 'active' ? 'pro' : 'free'

  const PLANS = {
    free: { posts_per_month: 20, repos: 1, platforms: 1 },
    pro: { posts_per_month: Infinity, repos: Infinity, platforms: Infinity },
  }
  const limits = PLANS[plan as keyof typeof PLANS]

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()

  const [
    { count: postsThisMonth },
    { count: totalPosts },
    { count: publishedPosts },
    { count: draftPosts },
    { count: repoCount },
    { count: platformCount },
    { data: recentPosts },
    { data: platformBreakdown },
  ] = await Promise.all([
    supabase.from('posts').select('*', { count: 'exact', head: true }).gte('created_at', monthStart).lt('created_at', monthEnd),
    supabase.from('posts').select('*', { count: 'exact', head: true }),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
    supabase.from('connected_repos').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('platform_connections').select('*', { count: 'exact', head: true }),
    supabase.from('posts').select('source_type').order('created_at', { ascending: false }).limit(30),
    supabase.from('posts').select('platforms').eq('status', 'published'),
  ])

  const platformCounts: Record<string, number> = {}
  for (const post of platformBreakdown ?? []) {
    for (const p of (post.platforms as string[]) ?? []) {
      platformCounts[p] = (platformCounts[p] ?? 0) + 1
    }
  }

  const sourceCounts: Record<string, number> = {}
  for (const post of recentPosts ?? []) {
    sourceCounts[post.source_type] = (sourceCounts[post.source_type] ?? 0) + 1
  }

  const usage = {
    posts_this_month: postsThisMonth ?? 0,
    total_posts: totalPosts ?? 0,
    published_posts: publishedPosts ?? 0,
    draft_posts: draftPosts ?? 0,
    repos: repoCount ?? 0,
    platforms: platformCount ?? 0,
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-50">Usage</h1>
        <Badge className={cn(
          'text-xs',
          plan === 'pro'
            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
            : 'bg-zinc-800 text-zinc-400 border-0'
        )}>
          {plan === 'pro' ? 'Pro' : 'Free'} plan
        </Badge>
      </div>

      {/* Plan limits */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-zinc-50 text-base">Plan Limits</CardTitle>
          <CardDescription className="text-zinc-500">
            Current billing period usage against your plan limits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <UsageBar
            label="Posts this month"
            used={usage.posts_this_month}
            limit={limits.posts_per_month}
          />
          <UsageBar
            label="Connected repos"
            used={usage.repos}
            limit={limits.repos}
          />
          <UsageBar
            label="Connected platforms"
            used={usage.platforms}
            limit={limits.platforms}
          />
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Posts', value: usage.total_posts },
          { label: 'Published', value: usage.published_posts },
          { label: 'Drafts', value: usage.draft_posts },
          { label: 'This Month', value: usage.posts_this_month },
        ].map(stat => (
          <div key={stat.label} className="rounded-lg bg-zinc-900/50 px-4 py-3">
            <span className="text-xs text-zinc-500">{stat.label}</span>
            <p className="text-2xl font-semibold text-zinc-100 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Platform breakdown */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-zinc-50 text-base">By Platform</CardTitle>
            <CardDescription className="text-zinc-500">
              Published posts per platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(platformCounts).length === 0 ? (
              <p className="text-sm text-zinc-600 py-4 text-center">No published posts yet</p>
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
                          <span className="text-xs text-zinc-500 font-mono">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-500/70"
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

        {/* Source breakdown */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-zinc-50 text-base">By Source</CardTitle>
            <CardDescription className="text-zinc-500">
              Posts generated from each event type.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(sourceCounts).length === 0 ? (
              <p className="text-sm text-zinc-600 py-4 text-center">No posts yet</p>
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
                          <span className="text-xs text-zinc-500 font-mono">
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
