'use client'

import useSWR, { mutate } from 'swr'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

const GITHUB_APP_NAME = process.env.NEXT_PUBLIC_GITHUB_APP_NAME
const INSTALL_URL = GITHUB_APP_NAME
  ? `https://github.com/apps/${GITHUB_APP_NAME}/installations/new`
  : null

interface Repo {
  id: number
  full_name: string
  private: boolean
  description: string | null
  connected: boolean
}

interface ReposData {
  repos: Repo[]
  needsInstall: boolean
}

async function fetchRepos() {
  const { data, error } = await supabase.functions.invoke('github-app', {
    body: { action: 'list-repos' },
  })
  if (error) return { repos: [], needsInstall: true }
  return data as ReposData
}

export default function ReposPage() {
  const { data, isLoading } = useSWR<ReposData>('repos', fetchRepos)
  const [pending, setPending] = useState<number | null>(null)

  const repos = data?.repos ?? []
  const needsInstall = data?.needsInstall ?? false

  async function toggle(repo: Repo) {
    setPending(repo.id)
    if (repo.connected) {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/connect-repo`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ repo_id: repo.id }),
      })
    } else {
      await supabase.functions.invoke('connect-repo', {
        body: { repo_id: repo.id, full_name: repo.full_name },
      })
    }
    // Optimistic update + revalidate
    mutate('repos', {
      ...data,
      repos: repos.map(r => r.id === repo.id ? { ...r, connected: !r.connected } : r),
    }, { revalidate: true })
    setPending(null)
  }

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
          {INSTALL_URL ? (
            <a
              href={INSTALL_URL}
              className="bg-zinc-100 text-zinc-900 font-medium px-4 py-2 rounded-lg hover:bg-white transition-colors text-sm text-center shrink-0"
            >
              + Add repos
            </a>
          ) : (
            <span className="text-sm text-red-400">
              GitHub App not configured
            </span>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-8 text-center text-sm text-zinc-400">
            Loading…
          </div>
        )}

        {/* Needs install */}
        {!isLoading && (needsInstall || repos.length === 0) && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-10 flex flex-col items-center gap-4">
            <p className="font-semibold text-lg text-zinc-100 text-center">
              Install the BuildLog GitHub App
            </p>
            <p className="text-sm text-zinc-400 text-center">
              Grant access to your repos so BuildLog can receive push, PR, and release events.
            </p>
            {INSTALL_URL ? (
              <a
                href={INSTALL_URL}
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
        )}

        {/* Repo list */}
        {!isLoading && repos.length > 0 && (
          <div className="flex flex-col gap-2">
            {repos.map(repo => (
              <div
                key={repo.id}
                className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {repo.connected && (
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium text-zinc-100 truncate">{repo.full_name}</p>
                    {repo.description && (
                      <p className="text-xs text-zinc-500 truncate mt-0.5">{repo.description}</p>
                    )}
                  </div>
                  {repo.private && (
                    <span className="text-[10px] text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5 shrink-0">
                      private
                    </span>
                  )}
                </div>
                <button
                  onClick={() => toggle(repo)}
                  disabled={pending === repo.id}
                  className={`font-medium text-sm px-4 py-1.5 rounded-lg shrink-0 transition-colors disabled:opacity-50 ${
                    repo.connected
                      ? 'bg-zinc-800 text-zinc-300 hover:bg-red-950 hover:text-red-300'
                      : 'bg-zinc-100 text-zinc-900 hover:bg-white'
                  }`}
                >
                  {pending === repo.id ? '…' : repo.connected ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
