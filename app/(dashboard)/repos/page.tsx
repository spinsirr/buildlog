'use client'

import { useReposData } from '@/lib/hooks/use-dashboard-data'
import { ReposSkeleton } from './loading'
import { ReposClient } from './repos-client'

export default function ReposPage() {
  const { data, isLoading } = useReposData()

  if (isLoading || !data) return <ReposSkeleton />

  return <ReposClient initialRepos={data.repos} initialNeedsInstall={data.needsInstall} />
}
