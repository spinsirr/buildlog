import { requireUser } from "../_shared/auth.ts"
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts"
import { safeJson } from "../_shared/http.ts"
import { checkLimit } from "../_shared/subscription.ts"

Deno.serve(async (req) => {
  const optRes = handleOptions(req)
  if (optRes) return optRes

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, req)
  }

  const { user, supabase, error: authErr } = await requireUser(req)
  if (!user) return errorResponse(authErr!, 401, req)

  const { allowed } = await checkLimit(user.id, "posts", supabase)
  if (!allowed) {
    return jsonResponse(
      { error: "Monthly post limit reached. Upgrade to Pro for unlimited posts.", code: "plan_limit" },
      req,
      { status: 403 },
    )
  }

  const body = await safeJson<{ content?: string }>(req)
  if (!body?.content?.trim()) {
    return errorResponse("Content is required", 400, req)
  }

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
