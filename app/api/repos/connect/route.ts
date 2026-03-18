import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { repo_id, full_name } = await request.json()
  if (!repo_id || !full_name) {
    return NextResponse.json({ error: 'Missing repo_id or full_name' }, { status: 400 })
  }

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

  const webhookSecret = randomBytes(32).toString('hex')
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/github`

  // Install webhook via GitHub API
  const ghRes = await fetch(`https://api.github.com/repos/${full_name}/hooks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${profile.github_token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'web',
      active: true,
      events: ['push', 'pull_request', 'release'],
      config: {
        url: webhookUrl,
        content_type: 'json',
        secret: webhookSecret,
      },
    }),
  })

  if (!ghRes.ok) {
    const err = await ghRes.json()
    return NextResponse.json({ error: err.message ?? 'GitHub webhook install failed' }, { status: 502 })
  }

  const hook = await ghRes.json()

  // Store in Supabase
  const { error } = await serviceClient.from('connected_repos').upsert({
    user_id: user.id,
    github_repo_id: repo_id,
    full_name,
    webhook_id: hook.id,
    webhook_secret: webhookSecret,
    is_active: true,
  }, { onConflict: 'user_id,github_repo_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
