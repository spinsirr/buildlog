import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getInstallationOctokit } from '@/lib/github-app'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('github_installation_id')
    .eq('id', user.id)
    .single()

  if (!profile?.github_installation_id) {
    return NextResponse.json({ repos: [], needsInstall: true })
  }

  const octokit = await getInstallationOctokit(profile.github_installation_id)
  const { data } = await octokit.apps.listReposAccessibleToInstallation({ per_page: 100 })

  const { data: connectedRepos } = await serviceClient
    .from('connected_repos')
    .select('github_repo_id')
    .eq('user_id', user.id)

  const connectedIds = new Set(connectedRepos?.map((r: { github_repo_id: number }) => r.github_repo_id) ?? [])

  const repos = data.repositories.map((repo: { id: number; full_name: string; private: boolean; description: string | null }) => ({
    id: repo.id,
    full_name: repo.full_name,
    private: repo.private,
    description: repo.description,
    connected: connectedIds.has(repo.id),
  }))

  return NextResponse.json({ repos, needsInstall: false })
}
