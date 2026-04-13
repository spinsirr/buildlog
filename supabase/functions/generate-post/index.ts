import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { requireUser } from "../_shared/auth.ts"
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts"
import { fetchPrContext, type FileDiff } from "../_shared/github.ts"
import { parsePathParts, safeJson } from "../_shared/http.ts"
import { getLog, setupLogger } from "../_shared/logger.ts"
import { checkLimit } from "../_shared/subscription.ts"
import { callVercelAi } from "../_shared/vercel-ai.ts"

await setupLogger()
const log = getLog("generate-post")

Deno.serve(async (req) => {
  const optionsRes = handleOptions(req)
  if (optionsRes) return optionsRes

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, req)
  }

  const { user, supabase, error: authError } = await requireUser(req)
  if (!user) {
    return errorResponse(authError ?? "Unauthorized", 401, req)
  }

  const parts = parsePathParts(req, "generate-post")
  const isRegenerate = parts[0] === "regenerate"
  const isXhsCopy = parts[0] === "xhs-copy"

  try {
    if (isXhsCopy) return await handleXhsCopy(req, user.id, supabase)
    if (isRegenerate) return await handleRegenerate(req, user.id, supabase)
    return await handleGenerate(req, user.id, supabase)
  } catch (err) {
    log.error("unhandled error: {error}", { error: String(err), stack: (err as Error).stack })
    return errorResponse("Internal server error", 500, req)
  }
})

// ─── Helpers ────────────────────────────────────────────────────────────────

type EventData = {
  message?: string
  title?: string
  description?: string
  files?: string[]
  url?: string
  additions?: number
  deletions?: number
  filesChanged?: number
  commitMessages?: string[]
  diffs?: FileDiff[]
}

type VercelEvent = {
  sourceType: "commit" | "pr" | "release" | "tag"
  repoName: string
  repoId: string
  userId: string
  projectContext: string | null
  tone: "casual" | "professional" | "technical"
  autoPublish: boolean
  xPremium: boolean
  data: EventData
}

/** Build an AgentEvent-shaped object for the Vercel AI routes. */
function buildEvent(params: {
  sourceType: VercelEvent["sourceType"]
  repoName: string
  repoId: string
  userId: string
  projectContext: string | null
  tone: string
  xPremium: boolean
  data: EventData
}): VercelEvent {
  return {
    sourceType: params.sourceType,
    repoName: params.repoName,
    repoId: params.repoId,
    userId: params.userId,
    projectContext: params.projectContext,
    tone: (params.tone as VercelEvent["tone"]) ?? "casual",
    autoPublish: false,
    xPremium: params.xPremium,
    data: params.data,
  }
}

// ─── Handlers ───────────────────────────────────────────────────────────────

async function handleGenerate(
  req: Request,
  userId: string,
  supabase: SupabaseClient,
): Promise<Response> {
  const body = await safeJson<{
    sourceType: "commit" | "pr" | "release"
    repoName: string
    data: EventData
    repoId: string
  }>(req)

  if (!body) return errorResponse("Invalid JSON body", 400, req)

  const { sourceType, repoName, data, repoId } = body

  if (!sourceType || !repoName || !data || !repoId) {
    return errorResponse("Missing required fields: sourceType, repoName, data, repoId", 400, req)
  }

  if (!["commit", "pr", "release"].includes(sourceType)) {
    return errorResponse("sourceType must be one of: commit, pr, release", 400, req)
  }

  const { allowed, plan, count, limit } = await checkLimit(userId, "posts", supabase)
  if (!allowed) {
    return jsonResponse(
      {
        error: `Post limit reached (${count}/${limit} this month on ${plan} plan)`,
        code: "plan_limit",
      },
      req,
      { status: 403 },
    )
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tone, x_premium")
    .eq("id", userId)
    .single()
  const { data: repoRow } = await supabase
    .from("connected_repos")
    .select("project_context")
    .eq("id", repoId)
    .single()

  const event = buildEvent({
    sourceType,
    repoName,
    repoId,
    userId,
    projectContext: repoRow?.project_context ?? null,
    tone: profile?.tone ?? "casual",
    xPremium: profile?.x_premium === true,
    data,
  })

  const result = await callVercelAi<{ content: string }>("generate", { event })
  if (!result?.content) {
    return errorResponse("AI generation failed — please try again", 500, req)
  }

  const { data: post, error: insertError } = await supabase
    .from("posts")
    .insert({
      user_id: userId,
      repo_id: repoId,
      source_type: sourceType,
      source_data: data,
      content: result.content,
      original_content: result.content,
      status: "draft",
    })
    .select()
    .single()

  if (insertError) {
    log.error("insert error: {error}", { error: String(insertError) })
    return errorResponse("Failed to save post", 500, req)
  }

  return jsonResponse({ post }, req, { status: 201 })
}

async function handleRegenerate(
  req: Request,
  userId: string,
  supabase: SupabaseClient,
): Promise<Response> {
  const body = await safeJson<{ id: string }>(req)
  if (!body?.id) return errorResponse("Missing required field: id", 400, req)

  const { data: post, error: fetchError } = await supabase
    .from("posts")
    .select("id, user_id, source_type, source_data, repo_id")
    .eq("id", body.id)
    .single()

  if (fetchError || !post || post.user_id !== userId) {
    return errorResponse("Post not found", 404, req)
  }
  if (post.source_type === "manual") {
    return errorResponse("Cannot regenerate manual posts", 400, req)
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tone, github_installation_id, x_premium")
    .eq("id", userId)
    .single()

  let repoName = "unknown/repo"
  let projectContext: string | null = null
  if (post.repo_id) {
    const { data: repo } = await supabase
      .from("connected_repos")
      .select("full_name, project_context")
      .eq("id", post.repo_id)
      .single()
    if (repo?.full_name) repoName = repo.full_name
    projectContext = repo?.project_context ?? null
  }

  // Intro posts use a different generation path
  if (post.source_type === "intro") {
    if (!projectContext) {
      return errorResponse("No project context available to regenerate intro post", 400, req)
    }
    const result = await callVercelAi<{ content: string }>("intro", {
      repoName,
      projectContext,
      tone: profile?.tone ?? "casual",
      contentBudget: profile?.x_premium === true ? 4000 : 280,
    })
    if (!result?.content) return errorResponse("AI generation failed", 500, req)

    const { data: updatedPost, error: updateError } = await supabase
      .from("posts")
      .update({
        content: result.content,
        original_content: result.content,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id)
      .select()
      .single()
    if (updateError) {
      log.error("regenerate intro: update error: {error}", { error: String(updateError) })
      return errorResponse("Failed to update post", 500, req)
    }
    return jsonResponse({ post: updatedPost }, req, { status: 200 })
  }

  const sourceData = (post.source_data ?? {}) as Record<string, unknown>
  let diffs: FileDiff[] = []

  // For PR posts, re-fetch code diffs from GitHub for richer context
  if (
    post.source_type === "pr" &&
    profile?.github_installation_id &&
    sourceData.repo &&
    sourceData.pr_number
  ) {
    try {
      const prCtx = await fetchPrContext(
        profile.github_installation_id,
        sourceData.repo as string,
        sourceData.pr_number as number,
      )
      diffs = prCtx.diffs
    } catch (err) {
      log.warn("regenerate: failed to fetch PR diffs: {error}", { error: String(err) })
    }
  }

  const event = buildEvent({
    sourceType: post.source_type as VercelEvent["sourceType"],
    repoName,
    repoId: post.repo_id ?? "",
    userId,
    projectContext,
    tone: profile?.tone ?? "casual",
    xPremium: profile?.x_premium === true,
    data: { ...(sourceData as EventData), diffs },
  })

  const result = await callVercelAi<{ content: string }>("generate", { event })
  if (!result?.content) return errorResponse("AI generation failed", 500, req)

  const { data: updatedPost, error: updateError } = await supabase
    .from("posts")
    .update({
      content: result.content,
      original_content: result.content,
      updated_at: new Date().toISOString(),
    })
    .eq("id", post.id)
    .select()
    .single()
  if (updateError) {
    log.error("regenerate: update error: {error}", { error: String(updateError) })
    return errorResponse("Failed to update post", 500, req)
  }

  return jsonResponse({ post: updatedPost }, req, { status: 200 })
}

async function handleXhsCopy(
  req: Request,
  userId: string,
  supabase: SupabaseClient,
): Promise<Response> {
  const body = await safeJson<{ id: string; lang?: "en" | "zh" }>(req)
  if (!body?.id) return errorResponse("Missing required field: id", 400, req)

  const lang = body.lang === "zh" ? "zh" : "en"

  const { data: post, error: fetchError } = await supabase
    .from("posts")
    .select("id, user_id, source_type, source_data, repo_id")
    .eq("id", body.id)
    .single()

  if (fetchError || !post || post.user_id !== userId) {
    return errorResponse("Post not found", 404, req)
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("github_installation_id, tone, x_premium")
    .eq("id", userId)
    .single()

  let repoName = "unknown/repo"
  let projectContext: string | null = null
  if (post.repo_id) {
    const { data: repo } = await supabase
      .from("connected_repos")
      .select("full_name, project_context")
      .eq("id", post.repo_id)
      .single()
    if (repo?.full_name) repoName = repo.full_name
    projectContext = repo?.project_context ?? null
  }

  const sourceData = (post.source_data ?? {}) as Record<string, unknown>
  let diffs: FileDiff[] = []

  if (
    post.source_type === "pr" &&
    profile?.github_installation_id &&
    sourceData.repo &&
    sourceData.pr_number
  ) {
    try {
      const prCtx = await fetchPrContext(
        profile.github_installation_id,
        sourceData.repo as string,
        sourceData.pr_number as number,
      )
      diffs = prCtx.diffs
    } catch (err) {
      log.warn("xhs-copy: failed to fetch PR diffs: {error}", { error: String(err) })
    }
  }

  const event = buildEvent({
    sourceType: post.source_type as VercelEvent["sourceType"],
    repoName,
    repoId: post.repo_id ?? "",
    userId,
    projectContext,
    tone: profile?.tone ?? "casual",
    xPremium: profile?.x_premium === true,
    data: { ...(sourceData as EventData), diffs },
  })

  const result = await callVercelAi<{ content: string }>("xhs", { event, lang })
  if (!result?.content) return errorResponse("AI generation failed", 500, req)

  return jsonResponse({ content: result.content }, req, { status: 200 })
}
