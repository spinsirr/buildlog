import { createServerSupabaseClient } from '@/lib/supabase/server'
import { RepoList } from '@/components/repo-list'

const GITHUB_APP_NAME = process.env.NEXT_PUBLIC_GITHUB_APP_NAME
const INSTALL_URL = GITHUB_APP_NAME
  ? `https://github.com/apps/${GITHUB_APP_NAME}/installations/new`
  : null

export default async function ReposPage() {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase.functions.invoke('github-app', {
    body: { action: 'list-repos' },
  })

  const repos = error ? [] : (data?.repos ?? [])
  const needsInstall = error ? true : (data?.needsInstall ?? false)

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

        {/* Needs install */}
        {(needsInstall || repos.length === 0) ? (
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
        ) : (
          <RepoList initialRepos={repos} />
        )}
      </div>
    </div>
  )
}
