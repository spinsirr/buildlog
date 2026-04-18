import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"
import { publishToBluesky } from "./bluesky.ts"
import { publishToLinkedIn } from "./linkedin.ts"
import { getLog } from "./logger.ts"
import { contentForPlatform } from "./posts.ts"
import { publishToTwitter } from "./twitter.ts"

const log = getLog("publish")

export interface PublishResult {
  publishedPlatforms: string[]
  errors: Record<string, string>
  primaryPostId: string | null
  primaryPostUrl: string | null
}

/**
 * Publish a post to every connected platform, picking the per-platform
 * content variant when present and falling back to `defaultContent` otherwise.
 */
export async function publishToAllPlatforms(
  userId: string,
  defaultContent: string,
  variants: Record<string, string> | null | undefined,
  connectedPlatforms: Set<string>,
): Promise<PublishResult> {
  const publishedPlatforms: string[] = []
  const errors: Record<string, string> = {}
  let primaryPostId: string | null = null
  let primaryPostUrl: string | null = null

  const tasks: Promise<void>[] = []

  if (connectedPlatforms.has("twitter")) {
    const content = contentForPlatform(defaultContent, variants, "twitter")
    tasks.push(
      publishToTwitter(userId, content)
        .then(({ tweetId, tweetUrl }) => {
          publishedPlatforms.push("twitter")
          if (!primaryPostId) {
            primaryPostId = tweetId
            primaryPostUrl = tweetUrl
          }
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err)
          log.error("Twitter publish failed: {error}", { error: message })
          errors.twitter = message
        }),
    )
  }

  if (connectedPlatforms.has("linkedin")) {
    const content = contentForPlatform(defaultContent, variants, "linkedin")
    tasks.push(
      publishToLinkedIn(userId, content)
        .then(({ postId, postUrl }) => {
          publishedPlatforms.push("linkedin")
          if (!primaryPostId) {
            primaryPostId = postId
            primaryPostUrl = postUrl
          }
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err)
          log.error("LinkedIn publish failed: {error}", { error: message })
          errors.linkedin = message
        }),
    )
  }

  if (connectedPlatforms.has("bluesky")) {
    const content = contentForPlatform(defaultContent, variants, "bluesky")
    tasks.push(
      publishToBluesky(userId, content)
        .then(({ postUri, postUrl }) => {
          publishedPlatforms.push("bluesky")
          if (!primaryPostId) {
            primaryPostId = postUri
            primaryPostUrl = postUrl
          }
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err)
          log.error("Bluesky publish failed: {error}", { error: message })
          errors.bluesky = message
        }),
    )
  }

  await Promise.all(tasks)

  return { publishedPlatforms, errors, primaryPostId, primaryPostUrl }
}

/**
 * Fetch a user's connected platforms, publish content to all of them,
 * and update the post record with the results.
 *
 * Shared between publish-post (manual) and github-webhook (auto-publish).
 */
export async function fetchPlatformsAndPublish(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
  content: string,
  variants: Record<string, string> | null | undefined,
  extraUpdates?: Record<string, unknown>,
): Promise<PublishResult> {
  const { data: connections } = await supabase
    .from("platform_connections")
    .select("platform")
    .eq("user_id", userId)

  const connectedPlatforms = new Set(
    connections?.map((c: { platform: string }) => c.platform) ?? [],
  )

  const result = await publishToAllPlatforms(
    userId,
    content,
    variants,
    connectedPlatforms,
  )
  const hasFailures = Object.keys(result.errors).length > 0

  if (result.publishedPlatforms.length > 0) {
    const status = hasFailures ? "partial" : "published"
    await supabase
      .from("posts")
      .update({
        status,
        published_at: new Date().toISOString(),
        platforms: result.publishedPlatforms,
        platform_post_id: result.primaryPostId,
        platform_post_url: result.primaryPostUrl,
        ...(hasFailures
          ? {
            publish_results: {
              errors: result.errors,
              published: result.publishedPlatforms,
            },
          }
          : {}),
        ...extraUpdates,
      })
      .eq("id", postId)
  } else {
    await supabase
      .from("posts")
      .update({
        status: "draft",
        published_at: null,
        publish_results: {
          errors: result.errors,
          published: result.publishedPlatforms,
        },
      })
      .eq("id", postId)
  }

  return result
}
