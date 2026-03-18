'use client'

import { useEffect, useState } from 'react'

const INSTALL_URL = `https://github.com/apps/${process.env.NEXT_PUBLIC_GITHUB_APP_NAME}/installations/new`

interface Repo {
  id: number
  full_name: string
  private: boolean
  description: string | null
  connected: boolean
}

export default function ReposPage() {
  const [repos, setRepos] = useState<Repo[]>([])
  const [needsInstall, setNeedsInstall] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/repos')
      .then(r => r.json())
      .then(data => {
        setRepos(data.repos ?? [])
        setNeedsInstall(data.needsInstall ?? false)
      })
      .finally(() => setLoading(false))
  }, [])

  async function toggle(repo: Repo) {
    setPending(repo.id)
    if (repo.connected) {
      await fetch('/api/repos/connect', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_id: repo.id }),
      })
    } else {
      await fetch('/api/repos/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_id: repo.id, full_name: repo.full_name }),
      })
    }
    setRepos(prev =>
      prev.map(r => r.id === repo.id ? { ...r, connected: !r.connected } : r)
    )
    setPending(null)
  }

  return (
    <div className="min-h-screen bg-[#FFFDF5] p-8">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-['Space_Grotesk'] text-black">Repos</h1>
            <p className="font-mono text-sm text-black/60 mt-1">
              Connect GitHub repos to auto-generate posts from your activity.
            </p>
          </div>
          <a
            href={INSTALL_URL}
            className="border-4 border-black bg-black text-white font-bold font-['Space_Grotesk'] px-4 py-2 shadow-[8px_8px_0px_0px_#000] hover:bg-white hover:text-black active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-100"
          >
            + Add repos
          </a>
        </div>

        {/* Loading */}
        {loading && (
          <div className="border-4 border-black bg-white p-8 shadow-[8px_8px_0px_0px_#000] text-center font-mono text-black/60">
            Loading…
          </div>
        )}

        {/* Needs install */}
        {!loading && (needsInstall || repos.length === 0) && (
          <div className="border-4 border-black bg-white p-10 shadow-[8px_8px_0px_0px_#000] flex flex-col items-center gap-4">
            <p className="font-['Space_Grotesk'] font-bold text-xl text-black text-center">
              Install the BuildLog GitHub App
            </p>
            <p className="font-mono text-sm text-black/60 text-center">
              Grant access to your repos so BuildLog can receive push, PR, and release events.
            </p>
            <a
              href={INSTALL_URL}
              className="border-4 border-black bg-[#FFE135] text-black font-bold font-['Space_Grotesk'] px-6 py-3 shadow-[8px_8px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-100"
            >
              Install GitHub App
            </a>
          </div>
        )}

        {/* Repo list */}
        {!loading && repos.length > 0 && (
          <div className="flex flex-col gap-3">
            {repos.map(repo => (
              <div
                key={repo.id}
                className="border-4 border-black bg-white p-4 shadow-[8px_8px_0px_0px_#000] flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {repo.connected && (
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-black shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-mono font-bold text-black truncate">{repo.full_name}</p>
                    {repo.description && (
                      <p className="font-mono text-xs text-black/50 truncate mt-0.5">{repo.description}</p>
                    )}
                  </div>
                  {repo.private && (
                    <span className="border-2 border-black font-mono text-[10px] px-1.5 py-0.5 shrink-0">
                      private
                    </span>
                  )}
                </div>
                <button
                  onClick={() => toggle(repo)}
                  disabled={pending === repo.id}
                  className={`border-4 border-black font-bold font-['Space_Grotesk'] px-4 py-1.5 shrink-0 shadow-[4px_4px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-100 disabled:opacity-50 ${
                    repo.connected
                      ? 'bg-white text-black hover:bg-red-50'
                      : 'bg-black text-white hover:bg-zinc-800'
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
