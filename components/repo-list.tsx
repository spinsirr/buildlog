'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Repo } from '@/lib/types'

function timeAgo(date: string | null): string | null {
  if (!date) return null
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

type Branch = { name: string; protected: boolean }

function BranchPicker({
  repo,
  onUpdate,
}: {
  repo: Repo
  onUpdate: (branches: string[] | null) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [branches, setBranches] = useState<Branch[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set(repo.watched_branches ?? []))
  const [saving, setSaving] = useState(false)

  const fetchBranches = useCallback(async () => {
    if (branches) return
    setLoading(true)
    try {
      const { data } = await supabase.functions.invoke('github-app', {
        body: { action: 'list-branches', repo_full_name: repo.full_name },
      })
      setBranches((data as { branches?: Branch[] })?.branches ?? [])
    } finally {
      setLoading(false)
    }
  }, [supabase, repo.full_name, branches])

  const toggleBranch = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    const watched = selected.size > 0 ? [...selected] : null
    try {
      await supabase.functions.invoke('connect-repo', {
        method: 'PATCH',
        body: { repo_id: repo.id, watched_branches: watched },
      })
      onUpdate(watched)
    } finally {
      setSaving(false)
    }
  }

  // Check if selection changed from saved state
  const savedSet = new Set(repo.watched_branches ?? [])
  const hasChanges = selected.size !== savedSet.size || [...selected].some((b) => !savedSet.has(b))

  return (
    <div className="mt-3 pt-3 border-t border-zinc-800">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-zinc-400">
          Watched branches{' '}
          <span className="text-zinc-600">
            {repo.watched_branches?.length ? `(${repo.watched_branches.length} selected)` : '(all)'}
          </span>
        </p>
        {!branches && (
          <button
            type="button"
            onClick={fetchBranches}
            disabled={loading}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {loading ? 'Loading…' : 'Configure'}
          </button>
        )}
      </div>

      {branches && (
        <>
          {branches.length === 0 ? (
            <p className="text-xs text-zinc-600">No branches found</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {branches.map((b) => (
                <button
                  key={b.name}
                  type="button"
                  onClick={() => toggleBranch(b.name)}
                  className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                    selected.has(b.name)
                      ? 'bg-zinc-100 text-zinc-900 border-zinc-100'
                      : 'bg-transparent text-zinc-500 border-zinc-700 hover:border-zinc-500'
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Clear (watch all)
              </button>
            )}
            {hasChanges && (
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="text-xs px-3 py-1 rounded-md bg-zinc-100 text-zinc-900 hover:bg-white transition-colors disabled:opacity-50 ml-auto"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export function RepoList({ initialRepos }: { initialRepos: Repo[] }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
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
        prev.map((r) =>
          r.id === repo.id
            ? {
                ...r,
                connected: !r.connected,
                watched_branches: r.connected ? null : r.watched_branches,
              }
            : r
        )
      )
      router.refresh()
    } finally {
      setPending(null)
    }
  }

  function handleBranchUpdate(repoId: number, branches: string[] | null) {
    setRepos((prev) =>
      prev.map((r) => (r.id === repoId ? { ...r, watched_branches: branches } : r))
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {repos.map((repo) => (
        <div key={repo.id} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {repo.connected && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />}
              <div className="min-w-0">
                <p className="font-mono text-sm font-medium text-zinc-100 truncate">
                  {repo.full_name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {repo.description && (
                    <p className="text-xs text-zinc-500 truncate">{repo.description}</p>
                  )}
                  {repo.pushed_at && (
                    <span className="text-[10px] text-zinc-600 shrink-0">
                      {timeAgo(repo.pushed_at)}
                    </span>
                  )}
                </div>
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

          {repo.connected && (
            <BranchPicker
              repo={repo}
              onUpdate={(branches) => handleBranchUpdate(repo.id, branches)}
            />
          )}
        </div>
      ))}
    </div>
  )
}
