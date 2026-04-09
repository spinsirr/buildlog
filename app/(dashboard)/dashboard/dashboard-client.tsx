'use client'

import { HelpCircle } from 'lucide-react'
import Link from 'next/link'
import { useOnborda } from 'onborda'
import { useEffect, useRef } from 'react'
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
  const tourStarted = useRef(false)
  const hasPosts = posts.length > 0
  const showOnboarding = !hasRepos || !hasSocial || !hasPosts
  const draftCount = posts.filter((p) => p.status === 'draft').length

  useEffect(() => {
    if (showOnboarding && !tourStarted.current) {
      const seen = localStorage.getItem('buildlog-tour-seen')
      if (!seen) {
        tourStarted.current = true
        const t = setTimeout(() => {
          startOnborda('onboarding')
          localStorage.setItem('buildlog-tour-seen', '1')
        }, 600)
        return () => clearTimeout(t)
      }
    }
  }, [showOnboarding, startOnborda])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-zinc-50">Dashboard</h1>
          {showOnboarding && (
            <button
              type="button"
              onClick={() => startOnborda('onboarding')}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
              aria-label="Take a tour"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          )}
        </div>
        <Link
          id="onborda-connect-repo"
          href="/repos"
          className="inline-flex items-center justify-center h-7 px-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
        >
          Connect repo
        </Link>
      </div>

      <FocusCard hasRepos={hasRepos} hasSocial={hasSocial} draftCount={draftCount} />
      <DashboardStats stats={stats} />
      <DashboardPostsTable posts={posts} />
    </div>
  )
}
