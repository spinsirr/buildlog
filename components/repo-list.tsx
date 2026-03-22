'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Repo } from '@/lib/types'

const supabase = createClient()

export function RepoList({ initialRepos }: { initialRepos: Repo[] }) {
  const router = useRouter()
  const [repos, setRepos] = useState(initialRepos)
  const [pending, setPending] = useState<number | null>(null)

  async function toggle(repo: Repo) {
    setPending(repo.id)
    try {
      if (repo.connected) {
        await supabase.functions.invoke('connect-repo', {
          method: 'DELETE',
          body: { repo_id: repo.id },
        })
      } else {
        await supabase.functions.invoke('connect-repo', {
          body: { repo_id: repo.id, full_name: repo.full_name },
        })
      }
      setRepos((prev) =>
        prev.map((r) => (r.id === repo.id ? { ...r, connected: !r.connected } : r))
      )
      router.refresh()
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {repos.map((repo) => (
        <div
          key={repo.id}
          className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 min-w-0">
            {repo.connected && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />}
            <div className="min-w-0">
              <p className="font-mono text-sm font-medium text-zinc-100 truncate">
                {repo.full_name}
              </p>
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
            type="button"
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
  )
}
