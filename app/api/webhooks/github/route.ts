import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { generatePost } from '@/lib/ai/generate-post'
import { checkLimit } from '@/lib/subscription'

function verifySignature(body: string, signature: string): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET!
  const hmac = createHmac('sha256', secret)
  const digest = Buffer.from('sha256=' + hmac.update(body).digest('hex'))
  const sig = Buffer.from(signature)
  if (digest.length !== sig.length) return false
  return timingSafeEqual(digest, sig)
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('x-hub-signature-256') ?? ''
  const event = request.headers.get('x-github-event') ?? ''

  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(body)
  const installationId = payload.installation?.id
  const repoId = payload.repository?.id
  const repoFullName = payload.repository?.full_name

  if (!installationId || !repoId) return NextResponse.json({ ok: true })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('github_installation_id', installationId)
    .single()

  if (!profile) return NextResponse.json({ ok: true })

  const { data: repo } = await supabase
    .from('connected_repos')
    .select('id')
    .eq('user_id', profile.id)
    .eq('github_repo_id', repoId)
    .eq('is_active', true)
    .single()

  if (!repo) return NextResponse.json({ ok: true })

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

  // Enforce free tier post limit
  const { allowed } = await checkLimit(profile.id, 'posts')
  if (!allowed) return NextResponse.json({ ok: true, skipped: 'post_limit_reached' })

  const content = await generatePost({
    sourceType,
    repoName: repoFullName,
    data: postData,
  })

  await supabase.from('posts').insert({
    user_id: profile.id,
    repo_id: repo.id,
    source_type: sourceType,
    source_data: payload,
    content,
    status: 'draft',
  })

  return NextResponse.json({ ok: true })
}
