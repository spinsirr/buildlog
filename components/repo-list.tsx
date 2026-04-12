'use client'

import { Plus, RefreshCw, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { callEdgeFunction } from '@/lib/edge-function'
import { createClient } from '@/lib/supabase/client'
import type { Repo } from '@/lib/types'
import { timeAgo } from '@/lib/utils'

const EVENT_TYPES = [
  { id: 'pull_request', label: 'Pull Requests', description: 'PRs merged into a branch' },
  { id: 'release', label: 'Releases', description: 'New releases published' },
  { id: 'create_tag', label: 'Tags', description: 'New tags pushed' },
] as const

function EventPicker({
  repo,
  onUpdate,
}: {
  repo: Repo
  onUpdate: (events: string[] | null) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [selected, setSelected] = useState<Set<string>>(new Set(repo.watched_events ?? []))
  const [saving, setSaving] = useState(false)

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    const watched = selected.size > 0 ? [...selected] : null
    try {
      await supabase.functions.invoke('connect-repo', {
        method: 'PATCH',
        body: { repo_id: repo.id, watched_events: watched },
      })
      onUpdate(watched)
    } finally {
      setSaving(false)
    }
  }

  const savedSet = new Set(repo.watched_events ?? [])
  const hasChanges = selected.size !== savedSet.size || [...selected].some((e) => !savedSet.has(e))

  return (
    <div className="mt-3 pt-3 border-t border-zinc-800">
      <p className="text-xs text-zinc-400 mb-2">
        Watched events{' '}
        <span className="text-zinc-600">
          {repo.watched_events?.length ? `(${repo.watched_events.length} selected)` : '(all)'}
        </span>
      </p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {EVENT_TYPES.map((evt) => (
          <button
            key={evt.id}
            type="button"
            onClick={() => toggle(evt.id)}
            title={evt.description}
            className={`text-xs px-2 py-1 rounded-md border transition-colors ${
              selected.has(evt.id)
                ? 'bg-zinc-100 text-zinc-900 border-zinc-100'
                : 'bg-transparent text-zinc-500 border-zinc-700 hover:border-zinc-500'
            }`}
          >
            {evt.label}
          </button>
        ))}
      </div>
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
    </div>
  )
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
  const [repos, setRepos] = useState(initialRepos)
  const [pending, setPending] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState<number | null>(null)

  async function connectRepo(repo: Repo) {
    setPending(repo.id)
    try {
      const result = await callEdgeFunction('connect-repo', {
        body: { repo_id: repo.id, full_name: repo.full_name },
      })
      if (!result.ok) {
        if (result.code === 'plan_limit') {
          toast.error(result.error, {
            action: { label: 'Upgrade', onClick: () => router.push('/settings') },
          })
        } else {
          toast.error(result.error || 'Something went wrong')
        }
        return
      }
      setRepos((prev) => prev.map((r) => (r.id === repo.id ? { ...r, connected: true } : r)))
      setSearch('')
      setModalOpen(false)
      router.refresh()
    } finally {
      setPending(null)
    }
  }

  async function disconnectRepo(repo: Repo) {
    setPending(repo.id)
    try {
      const result = await callEdgeFunction('connect-repo', {
        method: 'DELETE',
        body: { repo_id: repo.id },
      })
      if (!result.ok) {
        toast.error(result.error || 'Something went wrong')
        return
      }
      setRepos((prev) =>
        prev.map((r) =>
          r.id === repo.id
            ? { ...r, connected: false, watched_branches: null, watched_events: null }
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

  function handleEventUpdate(repoId: number, events: string[] | null) {
    setRepos((prev) => prev.map((r) => (r.id === repoId ? { ...r, watched_events: events } : r)))
  }

  async function handleRefreshContext(repo: Repo) {
    setRefreshing(repo.id)
    try {
      const result = await callEdgeFunction<{ ok: boolean }>('connect-repo', {
        method: 'PATCH',
        body: { repo_id: repo.id, refresh_context: true },
      })
      if (result.ok) {
        toast.success('Context refreshed', {
          description: `Updated project context for ${repo.full_name}`,
        })
      } else {
        toast.error(result.error || 'Failed to refresh context')
      }
    } finally {
      setRefreshing(null)
    }
  }

  const connectedRepos = repos.filter((r) => r.connected)
  const availableRepos = repos.filter((r) => !r.connected)

  const filteredAvailable = search.trim()
    ? availableRepos.filter(
        (r) =>
          r.full_name.toLowerCase().includes(search.toLowerCase()) ||
          r.description?.toLowerCase().includes(search.toLowerCase())
      )
    : availableRepos

  return (
    <>
      <div className="flex flex-col gap-2">
        {connectedRepos.length === 0 && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-10 flex flex-col items-center gap-3">
            <p className="text-sm text-zinc-400">No repos connected yet.</p>
            <Button
              size="sm"
              onClick={() => setModalOpen(true)}
              className="bg-zinc-100 text-zinc-900 hover:bg-white border-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Connect a repo
            </Button>
          </div>
        )}

        {connectedRepos.map((repo) => (
          <div key={repo.id} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
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
                onClick={() => disconnectRepo(repo)}
                disabled={pending === repo.id}
                className="font-medium text-sm px-4 py-1.5 rounded-lg shrink-0 transition-colors disabled:opacity-50 bg-zinc-800 text-zinc-300 hover:bg-red-950 hover:text-red-300"
              >
                {pending === repo.id ? '…' : 'Disconnect'}
              </button>
            </div>
            <EventPicker repo={repo} onUpdate={(events) => handleEventUpdate(repo.id, events)} />
            <BranchPicker
              repo={repo}
              onUpdate={(branches) => handleBranchUpdate(repo.id, branches)}
            />
            <div className="mt-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => handleRefreshContext(repo)}
                disabled={refreshing === repo.id}
                className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${refreshing === repo.id ? 'animate-spin' : ''}`} />
                {refreshing === repo.id ? 'Refreshing…' : 'Refresh project context'}
              </button>
            </div>
          </div>
        ))}

        {connectedRepos.length > 0 && availableRepos.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalOpen(true)}
            className="self-start border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Connect another repo
          </Button>
        )}
      </div>

      {/* Add repo modal */}
      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open)
          if (!open) setSearch('')
        }}
      >
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-200 sm:max-w-lg max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Connect a repo</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Search your GitHub repos to connect.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search repos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
            />
          </div>
          <div className="flex flex-col gap-1.5 overflow-y-auto min-h-0 -mx-1 px-1">
            {filteredAvailable.length === 0 && search.trim() && (
              <p className="text-sm text-zinc-500 text-center py-6">
                No repos matching &ldquo;{search}&rdquo;
              </p>
            )}
            {filteredAvailable.length === 0 && !search.trim() && (
              <p className="text-sm text-zinc-500 text-center py-6">
                All repos are already connected.
              </p>
            )}
            {filteredAvailable.map((repo) => (
              <button
                key={repo.id}
                type="button"
                onClick={() => connectRepo(repo)}
                disabled={pending === repo.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-zinc-800 transition-colors text-left disabled:opacity-50"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-medium text-zinc-100 truncate">
                    {repo.full_name}
                  </p>
                  {repo.description && (
                    <p className="text-xs text-zinc-500 truncate mt-0.5">{repo.description}</p>
                  )}
                </div>
                <span className="text-xs text-zinc-400 shrink-0">
                  {pending === repo.id ? '…' : 'Connect'}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
