import { generatePost } from '../_shared/ai.ts'
import { publishToBluesky } from '../_shared/bluesky.ts'
import { errorResponse, handleOptions, jsonResponse } from '../_shared/cors.ts'
import { hmacSha256Hex, timingSafeEqual } from '../_shared/crypto.ts'
import { publishToLinkedIn } from '../_shared/linkedin.ts'
import { notify } from '../_shared/notify.ts'
import { checkRateLimit } from '../_shared/rate-limit.ts'
import { checkLimit } from '../_shared/subscription.ts'
import { createServiceClient } from '../_shared/supabase.ts'
import { publishToTwitter } from '../_shared/twitter.ts'

const MAX_BODY_SIZE = 1024 * 1024 // 1MB

async function verifySignature(body: string, signature: string): Promise<boolean> {
  const secret = Deno.env.get('GITHUB_WEBHOOK_SECRET')
  if (!secret) {
    console.error('[github-webhook] Missing GITHUB_WEBHOOK_SECRET')
    return false
  }

  const computed = `sha256=${await hmacSha256Hex(secret, body)}`
  return timingSafeEqual(computed, signature)
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const optRes = handleOptions(req)
  if (optRes) return optRes

  // Only accept POST
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, req)
  }

  const rl = checkRateLimit(req, { limit: 60, windowMs: 60_000, key: 'github-webhook' })
  if (!rl.allowed) {
    return errorResponse('Rate limit exceeded', 429, req)
  }

  // Body size limit (check content-length header first)
  const contentLength = req.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return jsonResponse({ error: 'Payload too large' }, req, { status: 413 })
  }

  const body = await req.text()
  if (body.length > MAX_BODY_SIZE) {
    return jsonResponse({ error: 'Payload too large' }, req, { status: 413 })
  }

  // Verify GitHub HMAC-SHA256 signature
  const signature = req.headers.get('x-hub-signature-256') ?? ''
  const event = req.headers.get('x-github-event') ?? ''

  if (!(await verifySignature(body, signature))) {
    return jsonResponse({ error: 'Invalid signature' }, req, { status: 401 })
  }

  // Top-level try/catch — always return 200 to prevent GitHub retries
  try {
    return await handleWebhook(req, body, event)
  } catch (err) {
    console.error(
      '[github-webhook] Unhandled webhook error:',
      err instanceof Error ? err.message : String(err)
    )
    // Return 200 to prevent GitHub from retrying and creating duplicate posts
    return jsonResponse({ ok: true, error: 'internal' }, req)
  }
})

async function handleWebhook(req: Request, body: string, event: string): Promise<Response> {
  const payload = JSON.parse(body)
  const installationId = payload.installation?.id
  const repoId = payload.repository?.id
  const repoFullName = payload.repository?.full_name

  if (!installationId || !repoId) {
    return jsonResponse({ ok: true }, req)
  }

  const supabase = createServiceClient()

  // Look up user by installation ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, tone, auto_publish')
    .eq('github_installation_id', installationId)
    .single()

  if (!profile) {
    return jsonResponse({ ok: true }, req)
  }

  // Verify the repo is connected and active
  const { data: repo } = await supabase
    .from('connected_repos')
    .select('id')
    .eq('user_id', profile.id)
    .eq('github_repo_id', repoId)
    .eq('is_active', true)
    .single()

  if (!repo) {
    return jsonResponse({ ok: true }, req)
  }

  // Parse the event type and extract relevant data
  let sourceType: 'commit' | 'pr' | 'release' | null = null
  let postData: Record<string, string | string[] | number | undefined> = {}

  if (event === 'push' && payload.commits?.length > 0) {
    sourceType = 'commit'
    const commits = payload.commits as {
      message: string
      url: string
      added: string[]
      removed: string[]
      modified: string[]
    }[]

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
      const allFiles = commits.flatMap((c) => [
        ...(c.added ?? []),
        ...(c.modified ?? []),
        ...(c.removed ?? []),
      ])
      const uniqueFiles = [...new Set(allFiles)]
      postData = {
        message: `${commits.length} commits:\n- ${messages}`,
        url: payload.compare ?? commits[0].url,
        files: uniqueFiles,
        filesChanged: uniqueFiles.length,
      }
    }
  } else if (
    event === 'pull_request' &&
    payload.action === 'closed' &&
    payload.pull_request?.merged
  ) {
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

  // If it's not an event type we handle, acknowledge and return
  if (!sourceType) {
    return jsonResponse({ ok: true }, req)
  }

  // Deduplicate: check if we already processed this event
  const deliveryId = req.headers.get('x-github-delivery')
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
      return jsonResponse({ ok: true, skipped: 'duplicate' }, req)
    }
  }

  // Enforce post limit
  const { allowed } = await checkLimit(profile.id, 'posts', supabase)
  if (!allowed) {
    return jsonResponse({ ok: true, skipped: 'post_limit_reached' }, req)
  }

  // Generate AI content
  const content = await generatePost({
    sourceType,
    repoName: repoFullName,
    tone: profile.tone ?? 'casual',
    data: postData,
  })

  const shouldPublish = profile.auto_publish === true

  // Strip GitHub payload to essential fields only before storing
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

  // Create the post
  const { data: post } = await supabase
    .from('posts')
    .insert({
      user_id: profile.id,
      repo_id: repo.id,
      source_type: sourceType,
      source_data: strippedData,
      content,
      status: shouldPublish ? 'published' : 'draft',
      published_at: shouldPublish ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  if (shouldPublish && post) {
    // Check which platforms are connected
    const { data: connections } = await supabase
      .from('platform_connections')
      .select('platform')
      .eq('user_id', profile.id)

    const connectedPlatforms = new Set(
      connections?.map((c: { platform: string }) => c.platform) ?? []
    )
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
        console.error(`[github-webhook] Twitter publish failed for post ${post.id}: ${message}`)
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
        console.error(`[github-webhook] LinkedIn publish failed for post ${post.id}: ${message}`)
        failedPlatforms.linkedin = message
      }
    }

    // Publish to Bluesky if connected
    if (connectedPlatforms.has('bluesky')) {
      try {
        const { postUri, postUrl } = await publishToBluesky(profile.id, content)
        if (!primaryPostId) primaryPostId = postUri
        if (!primaryPostUrl) primaryPostUrl = postUrl
        publishedPlatforms.push('bluesky')
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[github-webhook] Bluesky publish failed for post ${post.id}: ${message}`)
        failedPlatforms.bluesky = message
      }
    }

    const hasFailures = Object.keys(failedPlatforms).length > 0

    if (publishedPlatforms.length > 0) {
      // Partial or full success
      const status = hasFailures ? 'partial' : 'published'
      await supabase
        .from('posts')
        .update({
          platform_post_id: primaryPostId,
          platform_post_url: primaryPostUrl,
          platforms: publishedPlatforms,
          status,
          ...(hasFailures
            ? { publish_results: { errors: failedPlatforms, published: publishedPlatforms } }
            : {}),
        })
        .eq('id', post.id)

      const failedNames = Object.keys(failedPlatforms)
      const notifMessage = hasFailures
        ? `Post published to ${publishedPlatforms.join(', ')} but failed on ${failedNames.join(
            ', '
          )} from ${sourceType} in ${repoFullName}`
        : `Post auto-published to ${publishedPlatforms.join(
            ', '
          )} from ${sourceType} in ${repoFullName}`

      try {
        await notify(supabase, {
          userId: profile.id,
          message: notifMessage,
          link: '/posts',
          subject: hasFailures ? 'Post published with errors' : 'Post auto-published',
        })
      } catch (notifyErr) {
        console.error('[github-webhook] notify failed:', notifyErr)
      }
    } else {
      // All platforms failed — revert to draft and record errors
      await supabase
        .from('posts')
        .update({
          status: 'draft',
          published_at: null,
          publish_results: { errors: failedPlatforms, published: publishedPlatforms },
        })
        .eq('id', post.id)

      try {
        await notify(supabase, {
          userId: profile.id,
          message: `Auto-publish failed for ${sourceType} in ${repoFullName}. Saved as draft.`,
          link: '/posts',
          subject: 'Auto-publish failed',
        })
      } catch (notifyErr) {
        console.error('[github-webhook] notify failed:', notifyErr)
      }
    }
  } else if (post) {
    // Notify user about new draft created from webhook
    try {
      await notify(supabase, {
        userId: profile.id,
        message: `New draft created from ${sourceType} in ${repoFullName}`,
        link: '/posts',
        subject: 'New draft post created',
      })
    } catch (notifyErr) {
      console.error('[github-webhook] notify failed:', notifyErr)
    }
  }

  return jsonResponse({ ok: true }, req)
}
