import { handleOptions, jsonResponse, errorResponse } from "../_shared/cors.ts"
import { createServiceClient } from "../_shared/supabase.ts"
import { requireUser } from "../_shared/auth.ts"
import { generatePost } from "../_shared/ai.ts"
import { checkLimit } from "../_shared/subscription.ts"
import { checkRateLimit } from "../_shared/rate-limit.ts"
import { parsePathParts } from "../_shared/http.ts"
import { safeJson } from "../_shared/http.ts"

Deno.serve(async (req) => {
  const optionsRes = handleOptions(req)
  if (optionsRes) return optionsRes

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, req)
  }

  const { allowed: rateLimitAllowed, retryAfter } = checkRateLimit(req, {
    limit: 20,
    windowMs: 60_000,
    key: "generate-post",
  })
  if (!rateLimitAllowed) {
    return errorResponse(`Rate limited. Retry after ${retryAfter}s`, 429, req)
  }

  const { user, error: authError } = await requireUser(req)
  if (!user) {
    return errorResponse(authError ?? "Unauthorized", 401, req)
  }

  const parts = parsePathParts(req, "generate-post")
  const isRegenerate = parts[0] === "regenerate"

  try {
    if (isRegenerate) {
      return await handleRegenerate(req, user.id)
    }
    return await handleGenerate(req, user.id)
  } catch (err) {
    console.error("[generate-post] unhandled error", err)
    return errorResponse("Internal server error", 500, req)
  }
})

async function handleGenerate(req: Request, userId: string): Promise<Response> {
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

  const { allowed, plan, count, limit } = await checkLimit(userId, "posts")
  if (!allowed) {
    return errorResponse(
      `Post limit reached (${count}/${limit} this month on ${plan} plan)`,
      403,
      req,
    )
  }

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from("profiles")
    .select("tone")
    .eq("id", userId)
    .single()

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
    console.error("[generate-post] insert error", insertError)
    return errorResponse("Failed to save post", 500, req)
  }

  return jsonResponse({ post }, { status: 201 }, req)
}

async function handleRegenerate(req: Request, userId: string): Promise<Response> {
  const body = await safeJson<{ id: string }>(req)

  if (!body?.id) {
    return errorResponse("Missing required field: id", 400, req)
  }

  const supabase = createServiceClient()

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("tone")
    .eq("id", userId)
    .single()

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
    console.error("[generate-post/regenerate] update error", updateError)
    return errorResponse("Failed to update post", 500, req)
  }

  return jsonResponse({ post: updatedPost }, { status: 200 }, req)
}
