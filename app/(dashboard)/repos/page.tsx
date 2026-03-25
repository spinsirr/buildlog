'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { ErrorState } from '@/components/error-state'
import { RepoList } from '@/components/repo-list'
import { createClient } from '@/lib/supabase/client'
import type { Repo } from '@/lib/types'
import { ReposSkeleton } from './loading'

const GITHUB_APP_NAME = process.env.NEXT_PUBLIC_GITHUB_APP_NAME

function getInstallUrl() {
  if (!GITHUB_APP_NAME) return null
  if (typeof window === 'undefined')
    return `https://github.com/apps/${GITHUB_APP_NAME}/installations/new`
  const state = encodeURIComponent(window.location.origin)
  return `https://github.com/apps/${GITHUB_APP_NAME}/installations/new?state=${state}`
}

export default function ReposPage() {
  return (
    <Suspense fallback={<ReposSkeleton />}>
      <ReposContent />
    </Suspense>
  )
}

function ReposContent() {
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const router = useRouter()
  const [installing, setInstalling] = useState(false)

  const fetchReposData = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('github-app', {
      body: { action: 'list-repos' },
    })

    if (error) {
      console.error('[repos] functions.invoke error:', error)
      throw error
    }

    const result = data as { repos?: Repo[]; needsInstall?: boolean } | null
    return {
      repos: result?.repos ?? [],
      needsInstall: result?.needsInstall ?? false,
    }
  }, [supabase])

  const { data, error, isLoading, mutate } = useSWR('repos-data', fetchReposData)

  // Handle GitHub App installation callback (installation_id in query params)
  useEffect(() => {
    const installationId = searchParams.get('installation_id')
    const setupAction = searchParams.get('setup_action')

    if (!installationId || setupAction === 'delete') return

    async function saveInstallation() {
      setInstalling(true)

      await supabase.functions.invoke('github-app', {
        body: { action: 'set-installation', installation_id: parseInt(installationId!, 10) },
      })

      router.replace('/repos')
      mutate()
      setInstalling(false)
    }

    saveInstallation()
  }, [searchParams, router, mutate, supabase])

  if (isLoading || installing) return <ReposSkeleton />
  if (error || !data) return <ErrorState retry={() => mutate()} />

  const { repos, needsInstall } = data

  return (
    <div>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">Repos</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Connect GitHub repos to auto-generate posts from your activity.
            </p>
          </div>
          {GITHUB_APP_NAME ? (
            <a
              href={getInstallUrl()!}
              className="bg-zinc-100 text-zinc-900 font-medium px-4 py-2 rounded-lg hover:bg-white transition-colors text-sm text-center shrink-0"
            >
              + Add repos
            </a>
          ) : (
            <span className="text-sm text-red-400">GitHub App not configured</span>
          )}
        </div>

        {/* Needs install */}
        {needsInstall || repos.length === 0 ? (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-10 flex flex-col items-center gap-4">
            <p className="font-semibold text-lg text-zinc-100 text-center">
              Install the BuildLog GitHub App
            </p>
            <p className="text-sm text-zinc-400 text-center">
              Grant access to your repos so BuildLog can receive push, PR, and release events.
            </p>
            {GITHUB_APP_NAME ? (
              <a
                href={getInstallUrl()!}
                className="bg-zinc-100 text-zinc-900 font-medium px-5 py-2.5 rounded-lg hover:bg-white transition-colors text-sm"
              >
                Install GitHub App
              </a>
            ) : (
              <p className="text-sm text-red-400">
                GitHub App is not configured. Set NEXT_PUBLIC_GITHUB_APP_NAME in your environment.
              </p>
            )}
          </div>
        ) : (
          <RepoList initialRepos={repos} />
        )}
      </div>
    </div>
  )
}
