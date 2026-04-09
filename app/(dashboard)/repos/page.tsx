import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Repo } from '@/lib/types'
import { ReposSkeleton } from './loading'
import { ReposClient } from './repos-client'

export default async function ReposPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase.functions.invoke('github-app', {
    body: { action: 'list-repos' },
  })

  if (error) {
    console.error('[repos] server fetch error:', error)
  }

  const result = data as { repos?: Repo[]; needsInstall?: boolean } | null

  return (
    <Suspense fallback={<ReposSkeleton />}>
      <ReposClient
        initialRepos={result?.repos ?? []}
        initialNeedsInstall={result?.needsInstall ?? error != null}
      />
    </Suspense>
  )
}
