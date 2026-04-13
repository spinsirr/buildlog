'use client'

import { useOnborda } from 'onborda'
import { DashboardPostsTable } from '@/components/dashboard-posts-table'
import { DashboardStats } from '@/components/dashboard-stats'
import { FocusCard } from '@/components/focus-card'
import type { Post } from '@/lib/types'
import { calculateStreak } from '@/lib/utils'

export function DashboardClient({
  repos,
  posts,
  connectionsCount,
  streakPosts,
}: {
  repos: { id: string }[]
  posts: Post[]
  connectionsCount: number
  streakPosts: { created_at: string }[]
}) {
  const { startOnborda } = useOnborda()

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
        <h1 className="text-2xl font-display font-bold uppercase tracking-tight text-zinc-50">
          Dashboard
        </h1>
        <button
          type="button"
          onClick={() => startOnborda('onboarding')}
          className="inline-flex items-center justify-center h-7 px-2.5 rounded-none border-2 border-zinc-600 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase tracking-wider font-mono-ui transition-colors shadow-[2px_2px_0px_0px_rgba(255,255,255,0.1)]"
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
