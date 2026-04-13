'use client'

import { FetchError } from '@/components/fetch-error'
import { useDashboardData } from '@/lib/hooks/use-dashboard-data'
import { DashboardClient } from './dashboard-client'
import { DashboardSkeleton } from './loading'

export default function DashboardPage() {
  const { data, error, isLoading, mutate } = useDashboardData()

  if (isLoading || !data) return <DashboardSkeleton />
  if (error) return <FetchError onRetry={() => mutate()} />

  return (
    <DashboardClient
      repos={data.repos}
      posts={data.posts}
      connectionsCount={data.connectionsCount}
      streakPosts={data.streakPosts}
    />
  )
}
