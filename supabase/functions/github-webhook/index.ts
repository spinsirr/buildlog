import { generatePost } from "../_shared/ai.ts"
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts"
import { hmacSha256Hex, timingSafeEqual } from "../_shared/crypto.ts"
import { fetchPrContext } from "../_shared/github.ts"
import { getLog, setupLogger } from "../_shared/logger.ts"
import { notify } from "../_shared/notify.ts"
import { fetchPlatformsAndPublish } from "../_shared/publish.ts"
import { checkLimit } from "../_shared/subscription.ts"
import { createServiceClient } from "../_shared/supabase.ts"

await setupLogger()
const log = getLog("github-webhook")

const MAX_BODY_SIZE = 1024 * 1024 // 1MB

async function verifySignature(body: string, signature: string): Promise<boolean> {
  const secret = Deno.env.get("GITHUB_WEBHOOK_SECRET")
  if (!secret) {
    log.error("missing GITHUB_WEBHOOK_SECRET")
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
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, req)
  }

  // Body size limit (check content-length header first)
  const contentLength = req.headers.get("content-length")
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return jsonResponse({ error: "Payload too large" }, req, { status: 413 })
  }

  const body = await req.text()
  if (body.length > MAX_BODY_SIZE) {
    return jsonResponse({ error: "Payload too large" }, req, { status: 413 })
  }

  // Verify GitHub HMAC-SHA256 signature
  const signature = req.headers.get("x-hub-signature-256") ?? ""
  const event = req.headers.get("x-github-event") ?? ""

  if (!(await verifySignature(body, signature))) {
    return jsonResponse({ error: "Invalid signature" }, req, { status: 401 })
  }

  // Top-level try/catch — always return 200 to prevent GitHub retries
  try {
    return await handleWebhook(req, body, event)
  } catch (err) {
    log.error("unhandled webhook error: {error}", {
      error: err instanceof Error ? err.message : String(err),
    })
    // Return 200 to prevent GitHub from retrying and creating duplicate posts
    return jsonResponse({ ok: true, error: "internal" }, req)
  }
})

async function handleInstallationEvent(
  payload: Record<string, unknown>,
  installationId: number,
  req: Request,
): Promise<Response> {
  const supabase = createServiceClient()
  const action = payload.action as string
  const sender = payload.sender as { id?: number } | undefined

  if (action === "created" && sender?.id) {
    // Auto-link: find user by github_user_id and save installation_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("github_user_id", sender.id)
      .single()

    if (profile) {
      await supabase
        .from("profiles")
        .update({ "github_installation_id": installationId })
        .eq("id", profile.id)
      log.info("webhook: linked installation {installationId} for user {userId}", {
        installationId,
        userId: profile.id,
      })
    }
  } else if (action === "deleted") {
    // Clear installation_id when app is uninstalled
    await supabase
      .from("profiles")
      .update({ "github_installation_id": null })
      .eq("github_installation_id", installationId)
    log.info("webhook: cleared installation {installationId} on uninstall", { installationId })
  }

  return jsonResponse({ ok: true }, req)
}

async function handleWebhook(req: Request, body: string, event: string): Promise<Response> {
  const payload = JSON.parse(body)
  const installationId = payload.installation?.id

  // Handle installation lifecycle (no repository context)
  if (event === "installation" && installationId) {
    return handleInstallationEvent(payload, installationId, req)
  }

  const repoId = payload.repository?.id
  const repoFullName = payload.repository?.full_name

  if (!installationId || !repoId) {
    return jsonResponse({ ok: true }, req)
  }

  const supabase = createServiceClient()

  // Look up user by installation ID
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tone, auto_publish")
    .eq("github_installation_id", installationId)
    .single()

  if (!profile) {
    return jsonResponse({ ok: true }, req)
  }

  // Verify the repo is connected and active
  const { data: repo } = await supabase
    .from("connected_repos")
    .select("id, watched_branches, watched_events")
    .eq("user_id", profile.id)
    .eq("github_repo_id", repoId)
    .eq("is_active", true)
    .single()

  if (!repo) {
    return jsonResponse({ ok: true }, req)
  }

  // Branch filtering for push events
  if (event === "push" && repo.watched_branches?.length) {
    const branch = (payload.ref as string)?.replace("refs/heads/", "")
    if (branch && !repo.watched_branches.includes(branch)) {
      return jsonResponse({ ok: true, skipped: "branch_not_watched" }, req)
    }
  }

  // Event type filtering
  // Map GitHub event names to our stored event identifiers
  const eventTypeMap: Record<string, string> = {
    "push": "push",
    "pull_request": "pull_request",
    "release": "release",
  }
  // create events with ref_type=tag map to create_tag
  let mappedEvent = eventTypeMap[event]
  if (event === "create" && payload.ref_type === "tag") {
    mappedEvent = "create_tag"
  }
  if (mappedEvent && repo.watched_events?.length) {
    if (!repo.watched_events.includes(mappedEvent)) {
      return jsonResponse({ ok: true, skipped: "event_not_watched" }, req)
    }
  }

  // Parse the event type and extract relevant data
  let sourceType: "commit" | "pr" | "release" | "tag" | null = null
  let postData: Record<string, string | string[] | number | undefined> = {}

  if (event === "push" && payload.commits?.length > 0) {
    sourceType = "commit"
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
      const messages = commits.map((c) => c.message.split("\n")[0]).join("\n- ")
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
    event === "pull_request" &&
    payload.action === "closed" &&
    payload.pull_request?.merged
  ) {
    sourceType = "pr"
    const pr = payload.pull_request

    // Fetch commit messages + file paths for richer AI context
    let commitMessages: string[] = []
    let files: string[] = []
    try {
      const prCtx = await fetchPrContext(installationId, repoFullName, pr.number)
      commitMessages = prCtx.commitMessages
      files = prCtx.files
    } catch (err) {
      log.warn("failed to fetch PR context, continuing with basic data: {error}", {
        error: String(err),
      })
    }

    postData = {
      title: pr.title,
      description: pr.body,
      url: pr.html_url,
      additions: pr.additions,
      deletions: pr.deletions,
      filesChanged: pr.changed_files,
      commitMessages,
      files,
    }
  } else if (event === "release" && payload.action === "published") {
    sourceType = "release"
    postData = {
      title: payload.release.tag_name,
      description: payload.release.body,
      url: payload.release.html_url,
    }
  } else if (event === "create" && payload.ref_type === "tag") {
    sourceType = "tag"
    postData = {
      title: payload.ref,
      url: `https://github.com/${repoFullName}/releases/tag/${payload.ref}`,
    }
  }

  // If it's not an event type we handle, acknowledge and return
  if (!sourceType) {
    return jsonResponse({ ok: true }, req)
  }

  // Deduplicate: check if we already processed this event
  const deliveryId = req.headers.get("x-github-delivery")
  let dedupeKey: string | null = null

  if (deliveryId) {
    dedupeKey = `github:${deliveryId}`
  } else if (sourceType === "commit" && payload.head_commit?.id) {
    dedupeKey = `commit:${payload.head_commit.id}`
  } else if (sourceType === "pr" && payload.pull_request?.id) {
    dedupeKey = `pr:${payload.pull_request.id}`
  } else if (sourceType === "release" && payload.release?.id) {
    dedupeKey = `release:${payload.release.id}`
  } else if (sourceType === "tag" && payload.ref) {
    dedupeKey = `tag:${repoFullName}:${payload.ref}`
  }

  if (dedupeKey) {
    const { count } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .contains("source_data", { _dedupe_key: dedupeKey })

    if ((count ?? 0) > 0) {
      return jsonResponse({ ok: true, skipped: "duplicate" }, req)
    }
  }

  // Enforce post limit
  const { allowed } = await checkLimit(profile.id, "posts", supabase)
  if (!allowed) {
    return jsonResponse({ ok: true, skipped: "post_limit_reached" }, req)
  }

  // Generate AI content
  const content = await generatePost({
    sourceType,
    repoName: repoFullName,
    tone: profile.tone ?? "casual",
    data: postData,
  })

  const shouldPublish = profile.auto_publish === true

  // Strip GitHub payload to essential fields only before storing
  const strippedData: Record<string, unknown> = {
    repo: repoFullName,
    "source_type": sourceType,
  }
  if (dedupeKey) strippedData._dedupe_key = dedupeKey

  if (sourceType === "commit") {
    const headCommit = payload.head_commit
    strippedData.commit_sha = headCommit?.id
    strippedData.message = postData.message
    strippedData.author = headCommit?.author?.name ?? headCommit?.author?.username
    strippedData.branch = (payload.ref as string)?.replace("refs/heads/", "")
    strippedData.url = postData.url
    strippedData.files_changed = postData.filesChanged
    if (Array.isArray(postData.files)) {
      strippedData.files_summary = (postData.files as string[]).slice(0, 20)
    }
  } else if (sourceType === "pr") {
    strippedData.pr_number = payload.pull_request?.number
    strippedData.title = postData.title
    strippedData.url = postData.url
    strippedData.additions = postData.additions
    strippedData.deletions = postData.deletions
    strippedData.files_changed = postData.filesChanged
  } else if (sourceType === "release") {
    strippedData.tag = postData.title
    strippedData.url = postData.url
  } else if (sourceType === "tag") {
    strippedData.tag_name = postData.title
    strippedData.url = postData.url
  }

  // Create the post as draft first — only mark published after platforms succeed
  const { data: post } = await supabase
    .from("posts")
    .insert({
      user_id: profile.id,
      repo_id: repo.id,
      "source_type": sourceType,
      source_data: strippedData,
      content,
      status: "draft",
      published_at: null,
    })
    .select("id")
    .single()

  if (shouldPublish && post) {
    const result = await fetchPlatformsAndPublish(supabase, profile.id, post.id, content)
    const hasFailures = Object.keys(result.errors).length > 0

    if (result.publishedPlatforms.length > 0) {
      // At least one platform succeeded — mark as published
      await supabase
        .from("posts")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("id", post.id)

      const failedNames = Object.keys(result.errors)
      const notifMessage = hasFailures
        ? `Post published to ${result.publishedPlatforms.join(", ")} but failed on ${
          failedNames.join(", ")
        } from ${sourceType} in ${repoFullName}`
        : `Post auto-published to ${
          result.publishedPlatforms.join(", ")
        } from ${sourceType} in ${repoFullName}`

      try {
        await notify(supabase, {
          userId: profile.id,
          message: notifMessage,
          link: "/posts",
          subject: hasFailures ? "Post published with errors" : "Post auto-published",
        })
      } catch (notifyErr) {
        log.error("notify failed: {error}", { error: String(notifyErr) })
      }
    } else {
      // All platforms failed — stays as draft
      try {
        await notify(supabase, {
          userId: profile.id,
          message: `Auto-publish failed for ${sourceType} in ${repoFullName}. Saved as draft.`,
          link: "/posts",
          subject: "Auto-publish failed",
        })
      } catch (notifyErr) {
        log.error("notify failed: {error}", { error: String(notifyErr) })
      }
    }
  } else if (post) {
    // Notify user about new draft created from webhook
    try {
      await notify(supabase, {
        userId: profile.id,
        message: `New draft created from ${sourceType} in ${repoFullName}`,
        link: "/posts",
        subject: "New draft post created",
      })
    } catch (notifyErr) {
      log.error("notify failed: {error}", { error: String(notifyErr) })
    }
  }

  return jsonResponse({ ok: true }, req)
}
