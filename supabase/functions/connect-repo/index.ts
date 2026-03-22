import { requireUser } from "../_shared/auth.ts"
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts"
import { safeJson } from "../_shared/http.ts"
import { checkLimit } from "../_shared/subscription.ts"

Deno.serve(async (req) => {
  const optRes = handleOptions(req)
  if (optRes) return optRes

  const { user, supabase, error: authErr } = await requireUser(req)
  if (!user) return errorResponse(authErr!, 401, req)

  if (req.method === "POST") {
    const { allowed, limit } = await checkLimit(user.id, "repos")
    if (!allowed) {
      return errorResponse(
        `Free plan is limited to ${limit} repo. Upgrade to Pro for unlimited repos.`,
        403,
        req,
      )
    }

    const body = await safeJson<{ repo_id?: number; full_name?: string }>(req)
    if (!body?.repo_id || !body?.full_name) {
      return errorResponse("Missing repo_id or full_name", 400, req)
    }

    const { error } = await supabase.from("connected_repos").upsert(
      {
        user_id: user.id,
        github_repo_id: body.repo_id,
        full_name: body.full_name,
        is_active: true,
      },
      { onConflict: "user_id,github_repo_id" },
    )

    if (error) return errorResponse(error.message, 500, req)
    return jsonResponse({ ok: true }, req)
  }

  if (req.method === "DELETE") {
    const body = await safeJson<{ repo_id?: number }>(req)
    if (!body?.repo_id) {
      return errorResponse("Missing repo_id", 400, req)
    }

    await supabase
      .from("connected_repos")
      .delete()
      .eq("user_id", user.id)
      .eq("github_repo_id", body.repo_id)

    return jsonResponse({ ok: true }, req)
  }

  return errorResponse("Method not allowed", 405, req)
})
