import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { generatePost } from '@/lib/ai/generate-post'
import { checkLimit } from '@/lib/subscription'
import { publishToTwitter } from '@/lib/twitter'
import { publishToLinkedIn } from '@/lib/linkedin'
import { logger } from '@/lib/logger'

// Allow up to 30s for AI generation + publishing
export const maxDuration = 30

// Max webhook body size: 1MB
const MAX_BODY_SIZE = 1024 * 1024

function verifySignature(body: string, signature: string): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET!
  const hmac = createHmac('sha256', secret)
  const digest = Buffer.from('sha256=' + hmac.update(body).digest('hex'))
  const sig = Buffer.from(signature)
  if (digest.length !== sig.length) return false
  return timingSafeEqual(digest, sig)
}

export async function POST(request: NextRequest) {
  // Fix #9: Body size limit
  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  const body = await request.text()
  if (body.length > MAX_BODY_SIZE) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  const signature = request.headers.get('x-hub-signature-256') ?? ''
  const event = request.headers.get('x-github-event') ?? ''

  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Fix #6: Top-level try/catch — always return 200 to prevent GitHub retries
  try {
    return await handleWebhook(request, body, event)
  } catch (err) {
    logger.webhook.error`Unhandled webhook error: ${err instanceof Error ? err.message : String(err)}`
    // Return 200 to prevent GitHub from retrying and creating duplicate posts
    return NextResponse.json({ ok: true, error: 'internal' })
  }
}

async function handleWebhook(request: NextRequest, body: string, event: string) {
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

  // Deduplicate: check if we already processed this event
  const deliveryId = request.headers.get('x-github-delivery')
  let dedupeKey: string | null = null
  if (deliveryId) {
    dedupeKey = `github:${deliveryId}`
  } else if (sourceType === 'commit' && payload.head_commit?.id) {
    dedupeKey = `commit:${payload.head_commit.id}`
  } else if (sourceType === 'pr' && payload.pull_request?.id) {
    dedupeKey = `pr:${payload.pull_request.id}`
  } else if (sourceType === 'release' && payload.release?.id) {
    dedupeKey = `release:${payload.release.id}`
  }

  if (dedupeKey) {
    const { count } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .contains('source_data', { _dedupe_key: dedupeKey })
    if ((count ?? 0) > 0) {
      logger.webhook.info`Skipping duplicate webhook event: ${dedupeKey}`
      return NextResponse.json({ ok: true, skipped: 'duplicate' })
    }
  }

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

  // Fix #10: Strip GitHub payload to only essential fields instead of storing the entire payload
  const strippedData: Record<string, unknown> = {
    repo: repoFullName,
    source_type: sourceType,
  }
  if (dedupeKey) strippedData._dedupe_key = dedupeKey

  if (sourceType === 'commit') {
    const headCommit = payload.head_commit
    strippedData.commit_sha = headCommit?.id
    strippedData.message = postData.message
    strippedData.author = headCommit?.author?.name ?? headCommit?.author?.username
    strippedData.branch = (payload.ref as string)?.replace('refs/heads/', '')
    strippedData.url = postData.url
    strippedData.files_changed = postData.filesChanged
    if (Array.isArray(postData.files)) {
      strippedData.files_summary = (postData.files as string[]).slice(0, 20)
    }
  } else if (sourceType === 'pr') {
    strippedData.pr_number = payload.pull_request?.number
    strippedData.title = postData.title
    strippedData.url = postData.url
    strippedData.additions = postData.additions
    strippedData.deletions = postData.deletions
    strippedData.files_changed = postData.filesChanged
  } else if (sourceType === 'release') {
    strippedData.tag = postData.title
    strippedData.url = postData.url
  }

  const { data: post } = await supabase.from('posts').insert({
    user_id: profile.id,
    repo_id: repo.id,
    source_type: sourceType,
    source_data: strippedData,
    content,
    status: shouldPublish ? 'published' : 'draft',
    published_at: shouldPublish ? new Date().toISOString() : null,
  }).select('id').single()

  if (shouldPublish && post) {
    // Check which platforms are connected
    const { data: connections } = await supabase
      .from('platform_connections')
      .select('platform')
      .eq('user_id', profile.id)

    const connectedPlatforms = new Set(connections?.map((c) => c.platform) ?? [])
    const publishedPlatforms: string[] = []
    const failedPlatforms: Record<string, string> = {}
    let primaryPostUrl: string | null = null
    let primaryPostId: string | null = null

    // Publish to Twitter if connected
    if (connectedPlatforms.has('twitter')) {
      try {
        const { tweetId, tweetUrl } = await publishToTwitter(profile.id, content)
        primaryPostId = tweetId
        primaryPostUrl = tweetUrl
        publishedPlatforms.push('twitter')
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.webhook.error`Twitter publish failed for post ${post.id}: ${message}`
        failedPlatforms.twitter = message
      }
    }

    // Publish to LinkedIn if connected
    if (connectedPlatforms.has('linkedin')) {
      try {
        const { postId, postUrl } = await publishToLinkedIn(profile.id, content)
        if (!primaryPostId) primaryPostId = postId
        if (!primaryPostUrl) primaryPostUrl = postUrl
        publishedPlatforms.push('linkedin')
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.webhook.error`LinkedIn publish failed for post ${post.id}: ${message}`
        failedPlatforms.linkedin = message
      }
    }

    const hasFailures = Object.keys(failedPlatforms).length > 0

    if (publishedPlatforms.length > 0) {
      // Partial or full success
      const status = hasFailures ? 'partial' : 'published'
      await supabase.from('posts').update({
        platform_post_id: primaryPostId,
        platform_post_url: primaryPostUrl,
        platforms: publishedPlatforms,
        status,
        ...(hasFailures ? { publish_results: { errors: failedPlatforms, published: publishedPlatforms } } : {}),
      }).eq('id', post.id)

      const failedNames = Object.keys(failedPlatforms)
      const notifMessage = hasFailures
        ? `Post published to ${publishedPlatforms.join(', ')} but failed on ${failedNames.join(', ')} from ${sourceType} in ${repoFullName}`
        : `Post auto-published to ${publishedPlatforms.join(', ')} from ${sourceType} in ${repoFullName}`

      await supabase.from('notifications').insert({
        user_id: profile.id,
        message: notifMessage,
        link: '/posts',
      })
    } else {
      // All platforms failed — revert to draft and record errors
      await supabase.from('posts').update({
        status: 'draft',
        published_at: null,
        publish_results: { errors: failedPlatforms, published: publishedPlatforms },
      }).eq('id', post.id)

      await supabase.from('notifications').insert({
        user_id: profile.id,
        message: `Auto-publish failed for ${sourceType} in ${repoFullName}. Saved as draft.`,
        link: '/posts',
      })
    }
  } else if (post) {
    // Notify user about new draft created from webhook
    await supabase.from('notifications').insert({
      user_id: profile.id,
      message: `New draft created from ${sourceType} in ${repoFullName}`,
      link: '/posts',
    })
  }

  return NextResponse.json({ ok: true })
}
