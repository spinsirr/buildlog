'use client'

import useSWR from 'swr'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const supabase = createClient()

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
        <span
          className={cn(
            'text-sm font-mono',
            isAtLimit ? 'text-red-400' : isNearLimit ? 'text-amber-400' : 'text-zinc-400'
          )}
        >
          {used}
          {isUnlimited ? '' : ` / ${limit}`}
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

async function fetchUsageData() {
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

  const [{ data: allPosts }, { count: repoCount }, { count: platformCount }] = await Promise.all([
    supabase
      .from('posts')
      .select('status, source_type, platforms, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('connected_repos')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase.from('platform_connections').select('*', { count: 'exact', head: true }),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const posts: any[] = allPosts ?? []
  const publishedPosts = posts.filter((p: any) => p.status === 'published')
  const draftPosts = posts.filter((p: any) => p.status === 'draft')
  const postsThisMonth = posts.filter((p: any) => p.created_at >= monthStart)

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

  return {
    plan,
    limits,
    usage: {
      posts_this_month: postsThisMonth.length,
      total_posts: posts.length,
      published_posts: publishedPosts.length,
      draft_posts: draftPosts.length,
      repos: repoCount ?? 0,
      platforms: platformCount ?? 0,
    },
    platformCounts,
    sourceCounts,
  }
}

function UsageSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-6 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-64" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-zinc-900/50 px-4 py-3 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}

function ErrorState({ retry }: { retry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
        <span className="text-red-400 text-lg">!</span>
      </div>
      <p className="text-sm text-zinc-400">Something went wrong loading usage data.</p>
      <button
        type="button"
        onClick={retry}
        className="px-4 py-2 text-sm rounded-md bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}

export default function UsagePage() {
  const { data, error, isLoading, mutate } = useSWR('usage-data', fetchUsageData)

  if (isLoading) return <UsageSkeleton />
  if (error || !data) return <ErrorState retry={() => mutate()} />

  const { plan, limits, usage, platformCounts, sourceCounts } = data

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-50">Usage</h1>
        <Badge
          className={cn(
            'text-xs',
            plan === 'pro'
              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
              : 'bg-zinc-800 text-zinc-400 border-0'
          )}
        >
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
          <UsageBar label="Connected repos" used={usage.repos} limit={limits.repos} />
          <UsageBar label="Connected platforms" used={usage.platforms} limit={limits.platforms} />
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Posts', value: usage.total_posts },
          { label: 'Published', value: usage.published_posts },
          { label: 'Drafts', value: usage.draft_posts },
          { label: 'This Month', value: usage.posts_this_month },
        ].map((stat) => (
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
