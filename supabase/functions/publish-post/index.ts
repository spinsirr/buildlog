import { requireUser } from '../_shared/auth.ts'
import { publishToBluesky } from '../_shared/bluesky.ts'
import { errorResponse, handleOptions, jsonResponse } from '../_shared/cors.ts'
import { safeJson } from '../_shared/http.ts'
import { publishToLinkedIn } from '../_shared/linkedin.ts'
import { checkRateLimit } from '../_shared/rate-limit.ts'
import { createServiceClient } from '../_shared/supabase.ts'
import { publishToTwitter } from '../_shared/twitter.ts'

Deno.serve(async (req) => {
  const optRes = handleOptions(req)
  if (optRes) return optRes

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, req)
  }

  const rl = checkRateLimit(req, { limit: 5, windowMs: 60_000, key: 'publish' })
  if (!rl.allowed) return errorResponse('Rate limit exceeded', 429, req)

  const { user, error: authErr } = await requireUser(req)
  if (!user) return errorResponse(authErr!, 401, req)

  const body = await safeJson<{ id?: string; content?: string }>(req)
  if (!body?.id) return errorResponse('Post ID is required', 400, req)

  const supabase = createServiceClient()

  // Fetch and verify post ownership
  const { data: currentPost } = await supabase
    .from('posts')
    .select('content, status')
    .eq('id', body.id)
    .eq('user_id', user.id)
    .single()

  if (!currentPost) return errorResponse('Post not found', 404, req)
  if (currentPost.status === 'published') {
    return errorResponse('Post is already published', 400, req)
  }

  const content = body.content ?? currentPost.content
  if (!content) return errorResponse('Post has no content', 400, req)

  // Get connected platforms for this user
  const { data: connections } = await supabase
    .from('platform_connections')
    .select('platform')
    .eq('user_id', user.id)

  const connectedPlatforms = new Set(connections?.map((c) => c.platform) ?? [])

  if (connectedPlatforms.size === 0) {
    return errorResponse(
      'No platforms connected. Connect Twitter, LinkedIn, or Bluesky in Settings.',
      400,
      req
    )
  }

  const publishedPlatforms: string[] = []
  const errors: string[] = []
  const updates: Record<string, unknown> = {
    status: 'published',
    published_at: new Date().toISOString(),
  }

  // Publish to each connected platform in parallel, catching errors individually
  const publishTasks: Promise<void>[] = []

  if (connectedPlatforms.has('twitter')) {
    publishTasks.push(
      publishToTwitter(user.id, content)
        .then(({ tweetId, tweetUrl }) => {
          publishedPlatforms.push('twitter')
          updates.platform_post_id = tweetId
          updates.platform_post_url = tweetUrl
        })
        .catch((err) => {
          errors.push(`Twitter: ${err instanceof Error ? err.message : String(err)}`)
        })
    )
  }

  if (connectedPlatforms.has('linkedin')) {
    publishTasks.push(
      publishToLinkedIn(user.id, content)
        .then(({ postId, postUrl }) => {
          publishedPlatforms.push('linkedin')
          // Only set platform_post_id/url if not already set by an earlier resolve
          if (!updates.platform_post_id) {
            updates.platform_post_id = postId
            updates.platform_post_url = postUrl
          }
        })
        .catch((err) => {
          errors.push(`LinkedIn: ${err instanceof Error ? err.message : String(err)}`)
        })
    )
  }

  if (connectedPlatforms.has('bluesky')) {
    publishTasks.push(
      publishToBluesky(user.id, content)
        .then(({ postUri, postUrl }) => {
          publishedPlatforms.push('bluesky')
          if (!updates.platform_post_id) {
            updates.platform_post_id = postUri
            updates.platform_post_url = postUrl
          }
        })
        .catch((err) => {
          errors.push(`Bluesky: ${err instanceof Error ? err.message : String(err)}`)
        })
    )
  }

  await Promise.all(publishTasks)

  // All connected platforms failed
  if (publishedPlatforms.length === 0) {
    return errorResponse(`Publishing failed: ${errors.join('; ')}`, 502, req)
  }

  updates.platforms = publishedPlatforms
  if (body.content) updates.content = body.content

  const { data: post, error } = await supabase
    .from('posts')
    .update(updates)
    .eq('id', body.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return errorResponse(error.message, 500, req)

  return jsonResponse({ post }, req)
})
