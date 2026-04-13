'use client'

import { FetchError } from '@/components/fetch-error'
import { useReposData } from '@/lib/hooks/use-dashboard-data'
import { ReposSkeleton } from './loading'
import { ReposClient } from './repos-client'

export default function ReposPage() {
  const { data, error, isLoading, mutate } = useReposData()

  if (isLoading || !data) return <ReposSkeleton />
  if (error) return <FetchError onRetry={() => mutate()} />

  return <ReposClient repos={data.repos} needsInstall={data.needsInstall} />
}
