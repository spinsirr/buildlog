import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { generatePost } from '@/lib/ai/generate-post'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  const { sourceType, repoName, data, userId, repoId } = await request.json()

  if (!sourceType || !repoName || !data || !userId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const content = await generatePost({ sourceType, repoName, data })

  const supabase = getSupabase()
  const { data: post, error } = await supabase.from('posts').insert({
    user_id: userId,
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
