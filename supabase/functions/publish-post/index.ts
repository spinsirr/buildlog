import { requireUser } from "../_shared/auth.ts"
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts"
import { safeJson } from "../_shared/http.ts"
import { fetchPlatformsAndPublish } from "../_shared/publish.ts"

Deno.serve(async (req) => {
  const optRes = handleOptions(req)
  if (optRes) return optRes

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, req)
  }

  const { user, supabase, error: authErr } = await requireUser(req)
  if (!user) return errorResponse(authErr!, 401, req)

  const body = await safeJson<{ id?: string; content?: string }>(req)
  if (!body?.id) return errorResponse("Post ID is required", 400, req)

  // Fetch and verify post ownership
  const { data: currentPost } = await supabase
    .from("posts")
    .select("content, status")
    .eq("id", body.id)
    .eq("user_id", user.id)
    .single()

  if (!currentPost) return errorResponse("Post not found", 404, req)
  if (currentPost.status === "published") {
    return errorResponse("Post is already published", 400, req)
  }

  const content = body.content ?? currentPost.content
  if (!content) return errorResponse("Post has no content", 400, req)

  // Check the user has at least one platform connected
  const { count: platformCount } = await supabase
    .from("platform_connections")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)

  if (!platformCount || platformCount === 0) {
    return errorResponse(
      "No platforms connected. Connect a social platform in Settings.",
      400,
      req,
    )
  }

  const extraUpdates = body.content ? { content: body.content } : undefined
  const result = await fetchPlatformsAndPublish(supabase, user.id, body.id, content, extraUpdates)

  if (result.publishedPlatforms.length === 0) {
    const errMsgs = Object.entries(result.errors).map(([p, e]) => `${p}: ${e}`).join("; ")
    return errorResponse(`Publishing failed: ${errMsgs}`, 502, req)
  }

  const { data: post, error } = await supabase
    .from("posts")
    .select()
    .eq("id", body.id)
    .eq("user_id", user.id)
    .single()

  if (error) return errorResponse(error.message, 500, req)

  return jsonResponse({ post }, req)
})
