import { getAuthorizationHeader, requireUser } from "../_shared/auth.ts"
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts"
import { safeJson } from "../_shared/http.ts"
import { checkRateLimit } from "../_shared/rate-limit.ts"
import { checkLimit } from "../_shared/subscription.ts"
import { createUserClient } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const optRes = handleOptions(req)
  if (optRes) return optRes

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, req)
  }

  const rl = checkRateLimit(req, { limit: 10, windowMs: 60_000, key: "create-post" })
  if (!rl.allowed) {
    return errorResponse("Rate limit exceeded", 429, req)
  }

  const { user, error: authErr } = await requireUser(req)
  if (!user) return errorResponse(authErr!, 401, req)

  const { allowed } = await checkLimit(user.id, "posts")
  if (!allowed) {
    return errorResponse(
      "Monthly post limit reached. Upgrade to Pro for unlimited posts.",
      403,
      req,
    )
  }

  const body = await safeJson<{ content?: string }>(req)
  if (!body?.content?.trim()) {
    return errorResponse("Content is required", 400, req)
  }

  const authHeader = getAuthorizationHeader(req)
  if (!authHeader) return errorResponse("Unauthorized", 401, req)
  const supabase = createUserClient(authHeader)

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,
      source_type: "manual",
      content: body.content.trim(),
      status: "draft",
    })
    .select("*, connected_repos(full_name)")
    .single()

  if (error) return errorResponse(error.message, 500, req)

  return jsonResponse({ post }, req)
})
