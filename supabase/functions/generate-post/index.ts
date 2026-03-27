import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { generatePost, generateXhsPost } from "../_shared/ai.ts"
import { requireUser } from "../_shared/auth.ts"
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts"
import { parsePathParts, safeJson } from "../_shared/http.ts"
import { getLog, setupLogger } from "../_shared/logger.ts"
import { checkLimit } from "../_shared/subscription.ts"

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
    if (isXhsCopy) {
      return await handleXhsCopy(req, user.id, supabase)
    }
    if (isRegenerate) {
      return await handleRegenerate(req, user.id, supabase)
    }
    return await handleGenerate(req, user.id, supabase)
  } catch (err) {
    log.error("unhandled error: {error}", { error: String(err), stack: (err as Error).stack })
    return errorResponse("Internal server error", 500, req)
  }
})

async function handleGenerate(
  req: Request,
  userId: string,
  supabase: SupabaseClient,
): Promise<Response> {
  const body = await safeJson<{
    sourceType: "commit" | "pr" | "release"
    repoName: string
    data: Record<string, unknown>
    repoId: string
  }>(req)

  if (!body) {
    return errorResponse("Invalid JSON body", 400, req)
  }

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

  const { data: profile } = await supabase.from("profiles").select("tone").eq("id", userId).single()

  const tone = profile?.tone ?? "casual"

  const content = await generatePost({
    sourceType,
    repoName,
    tone,
    data: data as {
      message?: string
      title?: string
      description?: string
      files?: string[]
      url?: string
      additions?: number
      deletions?: number
      filesChanged?: number
    },
  })

  const { data: post, error: insertError } = await supabase
    .from("posts")
    .insert({
      user_id: userId,
      repo_id: repoId,
      source_type: sourceType,
      source_data: data,
      content,
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

  if (!body?.id) {
    return errorResponse("Missing required field: id", 400, req)
  }

  const { data: post, error: fetchError } = await supabase
    .from("posts")
    .select("id, user_id, source_type, source_data, repo_id")
    .eq("id", body.id)
    .single()

  if (fetchError || !post) {
    return errorResponse("Post not found", 404, req)
  }

  if (post.user_id !== userId) {
    return errorResponse("Post not found", 404, req)
  }

  if (post.source_type === "manual") {
    return errorResponse("Cannot regenerate manual posts", 400, req)
  }

  // Get repo name from connected_repos
  let repoName = "unknown/repo"
  if (post.repo_id) {
    const { data: repo } = await supabase
      .from("connected_repos")
      .select("full_name")
      .eq("id", post.repo_id)
      .single()

    if (repo?.full_name) {
      repoName = repo.full_name
    }
  }

  const { data: profile } = await supabase.from("profiles").select("tone").eq("id", userId).single()

  const tone = profile?.tone ?? "casual"

  const content = await generatePost({
    sourceType: post.source_type as "commit" | "pr" | "release",
    repoName,
    tone,
    data: (post.source_data ?? {}) as {
      message?: string
      title?: string
      description?: string
      files?: string[]
      url?: string
      additions?: number
      deletions?: number
      filesChanged?: number
    },
  })

  const { data: updatedPost, error: updateError } = await supabase
    .from("posts")
    .update({ content, updated_at: new Date().toISOString() })
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
  const body = await safeJson<{ id: string }>(req)

  if (!body?.id) {
    return errorResponse("Missing required field: id", 400, req)
  }

  const { data: post, error: fetchError } = await supabase
    .from("posts")
    .select("id, user_id, source_type, source_data, repo_id")
    .eq("id", body.id)
    .single()

  if (fetchError || !post) {
    return errorResponse("Post not found", 404, req)
  }

  if (post.user_id !== userId) {
    return errorResponse("Post not found", 404, req)
  }

  let repoName = "unknown/repo"
  if (post.repo_id) {
    const { data: repo } = await supabase
      .from("connected_repos")
      .select("full_name")
      .eq("id", post.repo_id)
      .single()

    if (repo?.full_name) {
      repoName = repo.full_name
    }
  }

  const content = await generateXhsPost({
    sourceType: post.source_type as "commit" | "pr" | "release" | "tag",
    repoName,
    data: (post.source_data ?? {}) as {
      message?: string
      title?: string
      description?: string
      files?: string[]
      url?: string
      additions?: number
      deletions?: number
      filesChanged?: number
    },
  })

  return jsonResponse({ content }, req, { status: 200 })
}
