'use client'

import { HelpCircle } from 'lucide-react'
import Link from 'next/link'
import { useOnborda } from 'onborda'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import useSWR from 'swr'
import { DashboardPostsTable } from '@/components/dashboard-posts-table'
import { DashboardStats } from '@/components/dashboard-stats'
import { ErrorState } from '@/components/error-state'
import { createClient } from '@/lib/supabase/client'
import type { Post } from '@/lib/types'
import { calculateStreak } from '@/lib/utils'
import { DashboardSkeleton } from './loading'

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), [])
  const { startOnborda } = useOnborda()
  const tourStarted = useRef(false)

  const fetchDashboardData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const [{ data: repos }, { data: posts }, { count: connectionsCount }, { data: streakPosts }] =
      await Promise.all([
        supabase.from('connected_repos').select('*').eq('user_id', user.id),
        supabase
          .from('posts')
          .select('*, connected_repos(full_name)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('platform_connections')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('posts')
          .select('created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100),
      ])

    const allPosts = (posts ?? []) as Post[]
    const drafts = allPosts.filter((p) => p.status === 'draft')
    const published = allPosts.filter((p) => p.status === 'published')

    const streak = calculateStreak((streakPosts as { created_at: string }[]) ?? [])

    return {
      stats: [
        { label: 'Connected Repos', value: repos?.length ?? 0 },
        { label: 'Draft Posts', value: drafts.length },
        { label: 'Published', value: published.length },
        { label: 'Streak Days', value: streak },
      ],
      allPosts,
      hasRepos: (repos?.length ?? 0) > 0,
      hasSocial: (connectionsCount ?? 0) > 0,
      hasPosts: allPosts.length > 0,
    }
  }, [supabase])

  const { data, error, isLoading, mutate } = useSWR('dashboard-data', fetchDashboardData)

  const showOnboarding = data ? !data.hasRepos || !data.hasSocial || !data.hasPosts : false

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

  if (isLoading) return <DashboardSkeleton />
  if (error || !data) return <ErrorState retry={() => mutate()} />

  const { stats, allPosts } = data

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-zinc-50">Dashboard</h1>
          {showOnboarding && (
            <button
              type="button"
              onClick={() => startOnborda('onboarding')}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Take a tour"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          )}
        </div>
        <Link
          id="onborda-connect-repo"
          href="/repos"
          className="inline-flex items-center justify-center h-7 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[0.8rem] font-medium transition-colors"
        >
          Connect repo
        </Link>
      </div>

      <DashboardStats stats={stats} />
      <DashboardPostsTable posts={allPosts} />
    </div>
  )
}
