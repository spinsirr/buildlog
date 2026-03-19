import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'
import { generatePost } from '@/lib/ai/generate-post'
import { checkLimit } from '@/lib/subscription'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Enforce post limit
  const { allowed, limit, count } = await checkLimit(user.id, 'posts', supabase)
  if (!allowed) {
    return NextResponse.json(
      { error: `Monthly post limit reached (${count}/${limit}). Upgrade to Pro for unlimited posts.` },
      { status: 403 }
    )
  }

  const { sourceType, repoName, data, repoId } = await request.json()

  if (!sourceType || !repoName || !data) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('tone')
    .eq('id', user.id)
    .single()

  const content = await generatePost({ sourceType, repoName, data, tone: profile?.tone ?? 'casual' })
  const { data: post, error } = await serviceClient.from('posts').insert({
    user_id: user.id,
    repo_id: repoId ?? null,
    source_type: sourceType,
    source_data: data,
    content,
    status: 'draft',
  }).select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ post })
}
