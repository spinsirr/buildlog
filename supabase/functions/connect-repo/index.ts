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
      return jsonResponse(
        { error: `Free plan is limited to ${limit} repo. Upgrade to Pro for unlimited repos.`, code: "plan_limit" },
        req,
        { status: 403 },
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

  if (req.method === "PATCH") {
    const body = await safeJson<{
      repo_id?: number
      watched_branches?: string[] | null
      watched_events?: string[] | null
    }>(req)
    if (!body?.repo_id) {
      return errorResponse("Missing repo_id", 400, req)
    }

    // Build update payload — only include fields that were sent
    const update: Record<string, unknown> = {}
    if ("watched_branches" in (body ?? {})) {
      update.watched_branches = body.watched_branches?.length ? body.watched_branches : null
    }
    if ("watched_events" in (body ?? {})) {
      const validEvents = ["push", "pull_request", "release", "create_tag"]
      const events = body.watched_events?.filter((e) => validEvents.includes(e))
      update.watched_events = events?.length ? events : null
    }

    if (Object.keys(update).length === 0) {
      return errorResponse("No fields to update", 400, req)
    }

    const { error } = await supabase
      .from("connected_repos")
      .update(update)
      .eq("user_id", user.id)
      .eq("github_repo_id", body.repo_id)

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
