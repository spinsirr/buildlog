'use client'

import { useOnborda } from 'onborda'
import { DashboardPostsTable } from '@/components/dashboard-posts-table'
import { DashboardStats } from '@/components/dashboard-stats'
import { FocusCard } from '@/components/focus-card'
import type { Post } from '@/lib/types'

export function DashboardClient({
  stats,
  posts,
  hasRepos,
  hasSocial,
}: {
  stats: { label: string; value: number }[]
  posts: Post[]
  hasRepos: boolean
  hasSocial: boolean
}) {
  const { startOnborda } = useOnborda()
  const draftCount = posts.filter((p) => p.status === 'draft').length

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

      <FocusCard hasRepos={hasRepos} hasSocial={hasSocial} draftCount={draftCount} />
      <DashboardStats stats={stats} />
      <DashboardPostsTable posts={posts} />
    </div>
  )
}
