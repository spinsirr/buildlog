import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { generatePost } from '@/lib/ai/generate-post'
import { checkLimit } from '@/lib/subscription'
import { publishToTwitter } from '@/lib/twitter'

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
    .select('id, tone, auto_publish')
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
  let postData: Record<string, string | string[] | number | undefined> = {}

  if (event === 'push' && payload.commits?.length > 0) {
    sourceType = 'commit'
    const commits = payload.commits as { message: string; url: string; added: string[]; removed: string[]; modified: string[] }[]
    if (commits.length === 1) {
      const c = commits[0]
      const allFiles = [...(c.added ?? []), ...(c.modified ?? []), ...(c.removed ?? [])]
      postData = {
        message: c.message,
        url: c.url,
        files: allFiles,
        filesChanged: allFiles.length,
      }
    } else {
      // Summarize multiple commits
      const messages = commits.map((c) => c.message.split('\n')[0]).join('\n- ')
      const allFiles = commits.flatMap((c) => [...(c.added ?? []), ...(c.modified ?? []), ...(c.removed ?? [])])
      const uniqueFiles = [...new Set(allFiles)]
      postData = {
        message: `${commits.length} commits:\n- ${messages}`,
        url: payload.compare ?? commits[0].url,
        files: uniqueFiles,
        filesChanged: uniqueFiles.length,
      }
    }
  } else if (event === 'pull_request' && payload.action === 'closed' && payload.pull_request?.merged) {
    sourceType = 'pr'
    const pr = payload.pull_request
    postData = {
      title: pr.title,
      description: pr.body,
      url: pr.html_url,
      additions: pr.additions,
      deletions: pr.deletions,
      filesChanged: pr.changed_files,
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
  const { allowed } = await checkLimit(profile.id, 'posts', supabase)
  if (!allowed) return NextResponse.json({ ok: true, skipped: 'post_limit_reached' })

  const content = await generatePost({
    sourceType,
    repoName: repoFullName,
    tone: profile.tone ?? 'casual',
    data: postData,
  })

  const shouldPublish = profile.auto_publish === true

  const { data: post } = await supabase.from('posts').insert({
    user_id: profile.id,
    repo_id: repo.id,
    source_type: sourceType,
    source_data: payload,
    content,
    status: shouldPublish ? 'published' : 'draft',
    published_at: shouldPublish ? new Date().toISOString() : null,
  }).select('id').single()

  if (shouldPublish && post) {
    try {
      const { tweetId, tweetUrl } = await publishToTwitter(profile.id, content)
      await supabase.from('posts').update({
        platform_post_id: tweetId,
        platform_post_url: tweetUrl,
        platforms: ['twitter'],
      }).eq('id', post.id)
    } catch {
      // If publishing fails, revert to draft so user can retry manually
      await supabase.from('posts').update({ status: 'draft', published_at: null }).eq('id', post.id)
    }
  }

  return NextResponse.json({ ok: true })
}
