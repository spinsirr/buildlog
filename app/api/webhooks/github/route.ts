import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { generatePost } from '@/lib/ai/generate-post'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function verifySignature(body: string, signature: string, secret: string): boolean {
  const hmac = createHmac('sha256', secret)
  const digest = 'sha256=' + hmac.update(body).digest('hex')
  return digest === signature
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('x-hub-signature-256') ?? ''
  const event = request.headers.get('x-github-event') ?? ''
  const repoId = request.headers.get('x-github-hook-installation-target-id')

  const supabase = getSupabase()
  const { data: repo } = await supabase
    .from('connected_repos')
    .select('*')
    .eq('github_repo_id', repoId)
    .single()

  if (!repo || !verifySignature(body, signature, repo.webhook_secret ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = JSON.parse(body)
  let sourceType: 'commit' | 'pr' | 'release' | null = null
  let postData: Record<string, string | string[] | undefined> = {}

  if (event === 'push' && payload.commits?.length > 0) {
    sourceType = 'commit'
    const commit = payload.commits[0]
    postData = { message: commit.message, url: commit.url }
  } else if (event === 'pull_request' && payload.action === 'closed' && payload.pull_request?.merged) {
    sourceType = 'pr'
    postData = {
      title: payload.pull_request.title,
      description: payload.pull_request.body,
      url: payload.pull_request.html_url,
    }
  } else if (event === 'release' && payload.action === 'published') {
    sourceType = 'release'
    postData = {
      title: payload.release.tag_name,
      description: payload.release.body,
      url: payload.release.html_url,
    }
  }

  if (!sourceType) return NextResponse.json({ ok: true })

  const content = await generatePost({
    sourceType,
    repoName: repo.full_name,
    data: postData,
  })

  await supabase.from('posts').insert({
    user_id: repo.user_id,
    repo_id: repo.id,
    source_type: sourceType,
    source_data: payload,
    content,
    status: 'draft',
  })

  return NextResponse.json({ ok: true })
}
