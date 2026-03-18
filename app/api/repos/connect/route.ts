import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'
import { checkLimit } from '@/lib/subscription'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { allowed, plan, limit } = await checkLimit(user.id, 'repos')
  if (!allowed) {
    return NextResponse.json(
      { error: `Free plan is limited to ${limit} repo. Upgrade to Pro for unlimited repos.`, plan },
      { status: 403 }
    )
  }

  const { repo_id, full_name } = await request.json()
  if (!repo_id || !full_name) {
    return NextResponse.json({ error: 'Missing repo_id or full_name' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  const { error } = await serviceClient.from('connected_repos').upsert({
    user_id: user.id,
    github_repo_id: repo_id,
    full_name,
    is_active: true,
  }, { onConflict: 'user_id,github_repo_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { repo_id } = await request.json()

  const serviceClient = createServiceClient()

  await serviceClient.from('connected_repos')
    .delete()
    .eq('user_id', user.id)
    .eq('github_repo_id', repo_id)

  return NextResponse.json({ ok: true })
}
