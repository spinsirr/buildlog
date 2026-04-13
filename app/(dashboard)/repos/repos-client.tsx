'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useSWRConfig } from 'swr'
import { RepoList } from '@/components/repo-list'
import { buttonVariants } from '@/components/ui/button'
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

export function ReposClient({ repos, needsInstall }: { repos: Repo[]; needsInstall: boolean }) {
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const router = useRouter()
  const { mutate } = useSWRConfig()
  const [installing, setInstalling] = useState(false)

  // Handle GitHub App installation callback
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
      mutate((key: unknown) => Array.isArray(key) && key[0] === 'repos-data')
      setInstalling(false)
    }

    saveInstallation()
  }, [searchParams, router, mutate, supabase])

  if (installing) return <ReposSkeleton />

  return (
    <div>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold uppercase tracking-tight text-zinc-100">
              Repos
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Connect GitHub repos to auto-generate posts from your activity.
            </p>
          </div>
        </div>

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
                className={buttonVariants({
                  className: 'bg-zinc-100 text-zinc-900 hover:bg-white border-0',
                })}
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
