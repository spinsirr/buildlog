import { generateIntroPost } from "../_shared/ai.ts"
import { requireUser } from "../_shared/auth.ts"
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts"
import { fetchRepoContext } from "../_shared/github.ts"
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
        {
          error: `Free plan is limited to ${limit} repo. Upgrade to Pro for unlimited repos.`,
          code: "plan_limit",
        },
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

    // Fetch project context (README + manifest) — best-effort, don't fail the connect
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("github_installation_id")
        .eq("id", user.id)
        .single()

      if (profile?.github_installation_id) {
        const ctx = await fetchRepoContext(profile.github_installation_id, body.full_name)
        if (ctx) {
          // Store project context
          const { data: repoRow } = await supabase
            .from("connected_repos")
            .update({ project_context: ctx })
            .eq("user_id", user.id)
            .eq("github_repo_id", body.repo_id)
            .select("id")
            .single()

          // Generate intro post as first draft
          if (repoRow) {
            const content = await generateIntroPost(body.full_name, ctx)
            await supabase.from("posts").insert({
              user_id: user.id,
              repo_id: repoRow.id,
              source_type: "intro",
              content,
              original_content: content,
              status: "draft",
            })
          }
        }
      }
    } catch {
      // best-effort — connect still succeeded
    }

    return jsonResponse({ ok: true }, req)
  }

  if (req.method === "PATCH") {
    const body = await safeJson<{
      repo_id?: number
      watched_branches?: string[] | null
      watched_events?: string[] | null
      refresh_context?: boolean
    }>(req)
    if (!body?.repo_id) {
      return errorResponse("Missing repo_id", 400, req)
    }

    // Handle context refresh request
    if (body.refresh_context) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("github_installation_id")
          .eq("id", user.id)
          .single()

        if (!profile?.github_installation_id) {
          return errorResponse("GitHub not connected", 400, req)
        }

        const { data: repo } = await supabase
          .from("connected_repos")
          .select("id, full_name")
          .eq("user_id", user.id)
          .eq("github_repo_id", body.repo_id)
          .single()

        if (!repo) return errorResponse("Repo not found", 404, req)

        const ctx = await fetchRepoContext(profile.github_installation_id, repo.full_name)
        if (ctx) {
          await supabase
            .from("connected_repos")
            .update({ project_context: ctx })
            .eq("id", repo.id)
        }

        return jsonResponse({ ok: true, project_context: ctx }, req)
      } catch {
        return errorResponse("Failed to refresh context", 500, req)
      }
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
