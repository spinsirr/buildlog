import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get stored GitHub token
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('github_token')
    .eq('id', user.id)
    .single()

  if (!profile?.github_token) {
    return NextResponse.json({ error: 'No GitHub token — please log in again' }, { status: 403 })
  }

  // Fetch repos from GitHub API
  const res = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100&type=owner', {
    headers: {
      Authorization: `Bearer ${profile.github_token}`,
      Accept: 'application/vnd.github+json',
    },
  })
  if (!res.ok) return NextResponse.json({ error: 'GitHub API error' }, { status: 502 })

  const repos = await res.json()

  // Also get already-connected repos for this user
  const { data: connected } = await serviceClient
    .from('connected_repos')
    .select('github_repo_id')
    .eq('user_id', user.id)

  const connectedIds = new Set((connected ?? []).map((r: { github_repo_id: number }) => r.github_repo_id))

  const result = repos.map((r: { id: number; full_name: string; description: string | null; private: boolean; pushed_at: string }) => ({
    id: r.id,
    full_name: r.full_name,
    description: r.description,
    private: r.private,
    pushed_at: r.pushed_at,
    connected: connectedIds.has(r.id),
  }))

  return NextResponse.json({ repos: result })
}
