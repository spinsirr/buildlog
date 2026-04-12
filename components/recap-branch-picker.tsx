'use client'

import { GitBranch, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { callEdgeFunction } from '@/lib/edge-function'
import { createClient } from '@/lib/supabase/client'

interface ConnectedRepo {
  full_name: string
}

interface Branch {
  name: string
}

export function RecapBranchPicker({
  open,
  onOpenChange,
  onGenerate,
  loading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerate: (repo: string, branch: string) => void
  loading: boolean
}) {
  const supabase = useMemo(() => createClient(), [])
  const [repos, setRepos] = useState<ConnectedRepo[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedRepo, setSelectedRepo] = useState<string>('')
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [loadingBranches, setLoadingBranches] = useState(false)

  async function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      // Fetch repos on open
      setLoadingRepos(true)
      const { data } = await supabase
        .from('connected_repos')
        .select('full_name')
        .eq('is_active', true)
      setRepos((data as ConnectedRepo[] | null) ?? [])
      setLoadingRepos(false)
    } else {
      // Reset on close
      setSelectedRepo('')
      setSelectedBranch('')
      setBranches([])
    }
    onOpenChange(nextOpen)
  }

  async function handleRepoChange(repo: string | null) {
    const value = repo ?? ''
    setSelectedRepo(value)
    setSelectedBranch('')
    setBranches([])

    if (!value) return

    setLoadingBranches(true)
    try {
      const res = await callEdgeFunction<{ branches: Branch[] }>('github-app', {
        body: { action: 'list-branches', repo_full_name: value },
      })
      setBranches(res.ok ? res.data.branches : [])
    } catch {
      setBranches([])
    }
    setLoadingBranches(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-200 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Generate from Branch
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Pick a repo and branch to generate a recap post from its recent activity.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Repository</label>
            <Select value={selectedRepo} onValueChange={handleRepoChange} disabled={loadingRepos}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                <SelectValue
                  placeholder={loadingRepos ? 'Loading repos...' : 'Select a repository'}
                />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                {repos.map((r) => (
                  <SelectItem key={r.full_name} value={r.full_name} className="text-zinc-200">
                    {r.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Branch</label>
            <Select
              value={selectedBranch}
              onValueChange={(v) => setSelectedBranch(v ?? '')}
              disabled={!selectedRepo || loadingBranches}
            >
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                <SelectValue
                  placeholder={
                    loadingBranches
                      ? 'Loading branches...'
                      : !selectedRepo
                        ? 'Select a repo first'
                        : 'Select a branch'
                  }
                />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                {branches.map((b) => (
                  <SelectItem key={b.name} value={b.name} className="text-zinc-200">
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border-zinc-700 text-zinc-300"
          >
            Cancel
          </Button>
          <Button
            onClick={() => onGenerate(selectedRepo, selectedBranch)}
            disabled={!selectedRepo || !selectedBranch || loading}
            className="bg-purple-600 hover:bg-purple-500 text-white border-0"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
