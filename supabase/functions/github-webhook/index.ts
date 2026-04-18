import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts"
import { hmacSha256Hex, timingSafeEqual } from "../_shared/crypto.ts"
import type { FileDiff } from "../_shared/github.ts"
import { fetchCommitContext, fetchPrContext, fetchTagContext } from "../_shared/github.ts"
import { getLog, setupLogger } from "../_shared/logger.ts"
import { notify } from "../_shared/notify.ts"
import { fetchPlatformsAndPublish } from "../_shared/publish.ts"
import { checkLimit } from "../_shared/subscription.ts"
import { createServiceClient } from "../_shared/supabase.ts"
import { callVercelAi } from "../_shared/vercel-ai.ts"

await setupLogger()
const log = getLog("github-webhook")

const MAX_BODY_SIZE = 1024 * 1024 // 1MB

// ---------------------------------------------------------------------------
// Agent API — calls the Vercel Function for agentic decision + generation
// ---------------------------------------------------------------------------

interface AgentApiEvent {
  sourceType: string
  repoName: string
  repoId: string
  userId: string
  projectContext: string | null
  tone: string
  autoPublish: boolean
  xPremium: boolean
  data: Record<string, unknown>
}

interface AgentApiResult {
  signal: "high" | "low" | "error"
  reasoning: string
  confidence: "high" | "medium" | "low"
  angle: string | null
  content: string | null
  stepCount: number
}

async function callAgentApi(
  event: AgentApiEvent,
): Promise<AgentApiResult | null> {
  const appUrl = Deno.env.get("BUILDLOG_APP_URL")
  const secret = Deno.env.get("AGENT_API_SECRET")

  if (!appUrl || !secret) {
    log.warn(
      "agent API not configured (missing BUILDLOG_APP_URL or AGENT_API_SECRET)",
    )
    return null
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 45_000) // 45s timeout

    const res = await fetch(`${appUrl}/api/agent/decide`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-agent-secret": secret,
      },
      body: JSON.stringify(event),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      const text = await res.text()
      log.error("agent API error: {status} {body}", {
        status: res.status,
        body: text.slice(0, 200),
      })
      return null
    }

    return (await res.json()) as AgentApiResult
  } catch (err) {
    log.error("agent API call failed: {error}", {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

// ---------------------------------------------------------------------------
// Cheap pre-filter: skip obvious noise before spending AI/API tokens.
// Runs purely on webhook payload data — no GitHub API call needed.
// ---------------------------------------------------------------------------

type PushCommit = {
  message: string
  added?: string[]
  removed?: string[]
  modified?: string[]
}

const LOCKFILE_NAMES = new Set([
  "bun.lockb",
  "bun.lock",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "Cargo.lock",
  "poetry.lock",
  "uv.lock",
  "Gemfile.lock",
  "composer.lock",
  "go.sum",
])

function isLockfile(path: string): boolean {
  const name = path.split("/").pop() ?? ""
  return LOCKFILE_NAMES.has(name)
}

function isCiConfig(path: string): boolean {
  return (
    path.startsWith(".github/workflows/") ||
    path.startsWith(".github/actions/") ||
    path.startsWith(".circleci/") ||
    path.startsWith(".gitlab/") ||
    path === ".gitlab-ci.yml" ||
    path === "vercel.json" ||
    path === "netlify.toml" ||
    path === "fly.toml" ||
    path === "render.yaml"
  )
}

function isDocOrToolingFile(path: string): boolean {
  const lower = path.toLowerCase()
  const name = lower.split("/").pop() ?? ""
  if (
    lower.endsWith(".md") || lower.endsWith(".mdx") || lower.endsWith(".txt")
  ) return true
  if (name === "readme" || name === "changelog" || name === "license") {
    return true
  }
  if (name === ".gitignore" || name === ".gitattributes") return true
  if (name === ".editorconfig") return true
  if (name.startsWith(".prettierrc") || name === "prettier.config.js") {
    return true
  }
  if (name.startsWith(".eslintrc") || name === "eslint.config.js") return true
  if (name === "biome.json" || name === "biome.jsonc") return true
  return false
}

/**
 * Returns a skip reason if the push is obvious noise, else null.
 * Conservative — only skips when we're very confident it's not user-facing.
 */
function preFilterPush(commits: PushCommit[]): string | null {
  if (commits.length === 0) return "no_commits"

  // All merge commits — GitHub merge commits carry no product info
  if (commits.every((c) => c.message.startsWith("Merge "))) {
    return "merge_commits"
  }

  const uniqueFiles = [
    ...new Set(
      commits.flatMap((c) => [
        ...(c.added ?? []),
        ...(c.modified ?? []),
        ...(c.removed ?? []),
      ]),
    ),
  ]
  if (uniqueFiles.length === 0) return "no_files"

  // Lockfile-only pushes — auto-generated from dep version bumps
  if (uniqueFiles.every(isLockfile)) return "lockfile_only"

  // CI / deploy config only — infra, not user-facing
  if (uniqueFiles.every(isCiConfig)) return "ci_config_only"

  // Docs + tooling config only, confirmed by conventional commit prefix.
  // Only skip when BOTH signals agree to avoid dropping legitimate docs features.
  const firstMsg = commits[0]?.message ?? ""
  const isDocCommitPrefix = /^(docs|chore|style|build|ci|test)(\([^)]+\))?:/i
    .test(firstMsg)
  if (isDocCommitPrefix && uniqueFiles.every(isDocOrToolingFile)) {
    return "docs_or_tooling_only"
  }

  return null
}

async function verifySignature(
  body: string,
  signature: string,
): Promise<boolean> {
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
      log.info(
        "webhook: linked installation {installationId} for user {userId}",
        {
          installationId,
          userId: profile.id,
        },
      )
    }
  } else if (action === "deleted") {
    // Clear installation_id when app is uninstalled
    await supabase
      .from("profiles")
      .update({ "github_installation_id": null })
      .eq("github_installation_id", installationId)
    log.info("webhook: cleared installation {installationId} on uninstall", {
      installationId,
    })
  }

  return jsonResponse({ ok: true }, req)
}

async function handleWebhook(
  req: Request,
  body: string,
  event: string,
): Promise<Response> {
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
    .select("id, tone, auto_publish, decision_layer_enabled, x_premium")
    .eq("github_installation_id", installationId)
    .single()

  if (!profile) {
    return jsonResponse({ ok: true }, req)
  }

  // Verify the repo is connected and active
  const { data: repo } = await supabase
    .from("connected_repos")
    .select("id, watched_branches, watched_events, project_context")
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
  let postData: Record<
    string,
    string | string[] | number | FileDiff[] | undefined
  > = {}

  if (event === "push" && payload.commits?.length > 0) {
    sourceType = "commit"
    const commits = payload.commits as {
      message: string
      url: string
      added: string[]
      removed: string[]
      modified: string[]
    }[]

    // Cheap pre-filter — drop obvious noise before spending AI/API budget
    const skipReason = preFilterPush(commits)
    if (skipReason) {
      log.info("pre-filter skipped push in {repo}: {reason}", {
        repo: repoFullName,
        reason: skipReason,
      })
      return jsonResponse(
        { ok: true, skipped: `prefilter_${skipReason}` },
        req,
      )
    }

    if (commits.length === 1) {
      const c = commits[0]
      const allFiles = [
        ...(c.added ?? []),
        ...(c.modified ?? []),
        ...(c.removed ?? []),
      ]
      postData = {
        message: c.message,
        url: c.url,
        files: allFiles,
        filesChanged: allFiles.length,
      }
    } else {
      // Summarize multiple commits
      const messages = commits.map((c) => c.message.split("\n")[0]).join(
        "\n- ",
      )
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

    // Fetch real code diffs via the compare API so the AI can actually
    // read what changed, not just the commit message + file names.
    // Webhook payload has `before` (pre-push SHA) and `after` / `head_commit.id`.
    const beforeSha = typeof payload.before === "string" ? payload.before : undefined
    const afterSha = (typeof payload.after === "string" ? payload.after : undefined) ??
      payload.head_commit?.id
    if (beforeSha && afterSha) {
      try {
        const ctx = await fetchCommitContext(
          installationId,
          repoFullName,
          beforeSha,
          afterSha,
        )
        if (ctx.commitMessages.length > 0) {
          postData.commitMessages = ctx.commitMessages
        }
        if (ctx.files.length > 0) {
          postData.files = ctx.files
          postData.filesChanged = ctx.files.length
        }
        if (ctx.diffs.length > 0) postData.diffs = ctx.diffs
      } catch (err) {
        log.warn(
          "failed to fetch commit context, continuing with webhook data: {error}",
          {
            error: String(err),
          },
        )
      }
    }
  } else if (
    event === "pull_request" &&
    payload.action === "closed" &&
    payload.pull_request?.merged
  ) {
    sourceType = "pr"
    const pr = payload.pull_request

    // Fetch commit messages, file paths, and code diffs for richer AI context
    let prCtx: {
      commitMessages: string[]
      files: string[]
      diffs: Array<
        {
          filename: string
          status: string
          additions: number
          deletions: number
          patch?: string
        }
      >
    } = { commitMessages: [], files: [], diffs: [] }
    try {
      prCtx = await fetchPrContext(installationId, repoFullName, pr.number)
    } catch (err) {
      log.warn(
        "failed to fetch PR context, continuing with basic data: {error}",
        {
          error: String(err),
        },
      )
    }

    postData = {
      title: pr.title,
      description: pr.body,
      url: pr.html_url,
      additions: pr.additions,
      deletions: pr.deletions,
      filesChanged: pr.changed_files,
      commitMessages: prCtx.commitMessages,
      files: prCtx.files,
      diffs: prCtx.diffs,
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

    // Fetch commits and diffs between this tag and the previous tag
    let tagCtx: {
      commitMessages: string[]
      files: string[]
      diffs: Array<
        {
          filename: string
          status: string
          additions: number
          deletions: number
          patch?: string
        }
      >
      previousTag?: string
    } = { commitMessages: [], files: [], diffs: [] }
    try {
      tagCtx = await fetchTagContext(
        installationId,
        repoFullName,
        payload.ref as string,
      )
    } catch (err) {
      log.warn(
        "failed to fetch tag context, continuing with basic data: {error}",
        {
          error: String(err),
        },
      )
    }

    postData = {
      title: payload.ref,
      url: `https://github.com/${repoFullName}/releases/tag/${payload.ref}`,
      commitMessages: tagCtx.commitMessages,
      files: tagCtx.files,
      diffs: tagCtx.diffs,
      filesChanged: tagCtx.files.length,
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

  // ---------------------------------------------------------------------------
  // Ranker + generation layer
  // When decision_layer_enabled (default true), call the Vercel Agent API
  // which runs a two-phase pipeline:
  //   1. Ranker → { signal: 'high' | 'low', angle, reasoning }
  //   2. Content generation → post text
  //
  // Every event produces a draft. `signal` tells the dashboard how to
  // surface the post (high = default, low = collapsed under disclosure).
  // If the agent API is unavailable, fall back to direct Gemini generation
  // and leave signal null (the UI treats null as "unrated").
  // ---------------------------------------------------------------------------
  let content: string | undefined
  let signal: "high" | "low" | null = null
  let signalReason: string | null = null
  let angle: string | null = null

  if (profile.decision_layer_enabled) {
    const agentResult = await callAgentApi({
      sourceType,
      repoName: repoFullName,
      repoId: repo.id,
      userId: profile.id,
      projectContext: repo.project_context,
      tone: profile.tone ?? "casual",
      autoPublish: profile.auto_publish === true,
      xPremium: profile.x_premium === true,
      data: postData,
    })

    if (agentResult) {
      await supabase.from("post_decisions").insert({
        user_id: profile.id,
        repo_id: repo.id,
        source_type: sourceType,
        source_data: { ...postData, repo: repoFullName },
        dedupe_key: dedupeKey,
        decision: agentResult.signal, // reuse existing column — high/low/error
        reason: agentResult.reasoning,
        confidence: agentResult.confidence,
        angle: agentResult.angle,
        reasoning_trace: {
          steps: agentResult.stepCount,
          model: "ranker",
          reasoning: agentResult.reasoning,
        },
        agent_model: "gemini-3-flash-preview",
        step_count: agentResult.stepCount,
      })

      if (agentResult.signal === "error") {
        log.error("ranker error for {sourceType} in {repo}: {reason}", {
          sourceType,
          repo: repoFullName,
          reason: agentResult.reasoning,
        })
        // Fall through to direct generation below
      } else {
        signal = agentResult.signal
        signalReason = agentResult.reasoning
        angle = agentResult.angle
        if (agentResult.content) {
          content = agentResult.content
          log.info(
            "ranker produced {signal}-signal draft for {sourceType} in {repo}",
            { signal: agentResult.signal, sourceType, repo: repoFullName },
          )
        }
      }
    } else {
      log.warn("agent API unavailable, falling back to direct generation")
    }
  }

  // Vercel AI fallback — when ranker is off, unavailable, or errored
  if (!content) {
    const fallbackEvent = {
      sourceType,
      repoName: repoFullName,
      repoId: repo.id,
      userId: profile.id,
      projectContext: repo.project_context,
      tone: profile.tone ?? "casual",
      autoPublish: profile.auto_publish === true,
      xPremium: profile.x_premium === true,
      data: postData,
    }
    const result = await callVercelAi<{ content: string }>("generate", {
      event: fallbackEvent,
      angle: "shipping update",
      highlights: "",
    })
    content = result?.content ?? "Shipping update posted to BuildLog."
    if (!result?.content) {
      log.warn(
        "fallback generation failed for {sourceType} in {repo}, using placeholder",
        {
          sourceType,
          repo: repoFullName,
        },
      )
    }
  }

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
    strippedData.author = headCommit?.author?.name ??
      headCommit?.author?.username
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
      original_content: content,
      status: "draft",
      published_at: null,
      signal,
      signal_reason: signalReason,
      angle,
    })
    .select("id")
    .single()

  if (shouldPublish && post) {
    const result = await fetchPlatformsAndPublish(
      supabase,
      profile.id,
      post.id,
      content,
      null,
    )
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
