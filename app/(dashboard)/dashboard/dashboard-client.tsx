'use client'

import { useOnborda } from 'onborda'
import { DashboardPostsTable } from '@/components/dashboard-posts-table'
import { DashboardStats } from '@/components/dashboard-stats'
import { FocusCard } from '@/components/focus-card'
import { useDashboardData } from '@/lib/hooks/use-dashboard-data'
import { calculateStreak } from '@/lib/utils'
import { DashboardSkeleton } from './loading'

export function DashboardClient() {
  const { startOnborda } = useOnborda()
  const { data, isLoading } = useDashboardData()

  if (isLoading || !data) return <DashboardSkeleton />

  const { repos, posts, connectionsCount, streakPosts } = data
  const drafts = posts.filter((p) => p.status === 'draft')
  const published = posts.filter((p) => p.status === 'published')
  const streak = calculateStreak(streakPosts)
  const draftCount = drafts.length

  const stats = [
    { label: 'Connected Repos', value: repos.length },
    { label: 'Draft Posts', value: drafts.length },
    { label: 'Published', value: published.length },
    { label: 'Streak Days', value: streak },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-50">Dashboard</h1>
        <button
          type="button"
          onClick={() => startOnborda('onboarding')}
          className="inline-flex items-center justify-center h-7 px-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
        >
          Tutorial
        </button>
      </div>

      <FocusCard
        hasRepos={repos.length > 0}
        hasSocial={connectionsCount > 0}
        draftCount={draftCount}
      />
      <DashboardStats stats={stats} />
      <DashboardPostsTable posts={posts} />
    </div>
  )
}
