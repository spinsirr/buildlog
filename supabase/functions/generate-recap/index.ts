import { requireUser } from "../_shared/auth.ts"
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts"
import { fetchRepoRecapData, type RepoRecapData } from "../_shared/github.ts"
import { getLog, setupLogger } from "../_shared/logger.ts"
import { checkLimit } from "../_shared/subscription.ts"
import { callVercelAi } from "../_shared/vercel-ai.ts"

await setupLogger()
const log = getLog("generate-recap")

const RECAP_WINDOW_DAYS = 7

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

  // Enforce post limit — recaps count as posts
  const { allowed, count, limit } = await checkLimit(user.id, "posts", supabase)
  if (!allowed) {
    return jsonResponse(
      {
        ok: false,
        code: "plan_limit",
        error: `Free plan limit: ${count}/${limit} posts this month. Upgrade for unlimited.`,
      },
      req,
      { status: 403 },
    )
  }

  try {
    let mode: "week" | "branch" = "week"
    let targetRepo: string | undefined
    let targetBranch: string | undefined

    try {
      const body = await req.json()
      if (body.mode === "branch") mode = "branch"
      if (body.repo) targetRepo = body.repo as string
      if (body.branch) targetBranch = body.branch as string
    } catch {
      // No body or invalid JSON — use defaults
    }

    if (mode === "branch" && (!targetRepo || !targetBranch)) {
      return jsonResponse(
        { ok: false, reason: "invalid_request", error: "Branch mode requires repo and branch" },
        req,
      )
    }

    const since = new Date(Date.now() - RECAP_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

    // Dedup check — only one recap per week (per branch in branch mode)
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    monday.setHours(0, 0, 0, 0)

    if (mode === "week") {
      const { count: existingRecap } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("source_type", "recap")
        .is("source_data->branch", null)
        .gte("created_at", monday.toISOString())
      if ((existingRecap ?? 0) > 0) {
        return jsonResponse({ ok: false, reason: "recap_exists" }, req)
      }
    } else {
      const { data: existing } = await supabase
        .from("posts")
        .select("id, source_data")
        .eq("user_id", user.id)
        .eq("source_type", "recap")
        .gte("created_at", monday.toISOString())
      const hasDupe = existing?.some((p) => {
        const sd = p.source_data as Record<string, unknown> | null
        return sd?.repo === targetRepo && sd?.branch === targetBranch
      })
      if (hasDupe) return jsonResponse({ ok: false, reason: "recap_exists" }, req)
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tone, x_premium, github_installation_id")
      .eq("id", user.id)
      .single()

    const tone = profile?.tone ?? "casual"
    const charLimit = profile?.x_premium ? 4000 : 280
    const installationId = profile?.github_installation_id as number | null

    // Fetch GitHub activity
    let allRepoData: RepoRecapData[] = []
    const projectContexts: Record<string, string> = {}

    if (installationId) {
      if (mode === "branch" && targetRepo) {
        const data = await fetchRepoRecapData(installationId, targetRepo, since, targetBranch)
        allRepoData = [data]
      } else {
        const { data: repos } = await supabase
          .from("connected_repos")
          .select("full_name, project_context")
          .eq("user_id", user.id)
          .eq("is_active", true)

        if (repos && repos.length > 0) {
          for (const r of repos) {
            if (r.project_context) projectContexts[r.full_name] = r.project_context
          }
          const repoSlice = repos.slice(0, 5)
          const results = await Promise.allSettled(
            repoSlice.map((r) => fetchRepoRecapData(installationId, r.full_name, since)),
          )
          allRepoData = results
            .filter((r): r is PromiseFulfilledResult<RepoRecapData> => r.status === "fulfilled")
            .map((r) => r.value)
        }
      }
    }

    const { data: recentPosts } = await supabase
      .from("posts")
      .select("content, source_type, created_at")
      .eq("user_id", user.id)
      .in("status", ["published", "draft"])
      .neq("source_type", "recap")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20)

    const hasGitHubData = allRepoData.some(
      (r) => r.commits.length > 0 || r.mergedPrs.length > 0 || r.releases.length > 0,
    )
    const hasPosts = (recentPosts?.length ?? 0) > 0

    if (!hasGitHubData && !hasPosts) {
      return jsonResponse({ ok: false, reason: "no_activity" }, req)
    }

    // Generate via Vercel /api/agent/recap
    const result = await callVercelAi<{ content: string }>("recap", {
      repoData: allRepoData.map((r) => ({
        repoName: r.repoName,
        commits: r.commits,
        mergedPrs: r.mergedPrs,
        releases: r.releases,
      })),
      recentPosts: recentPosts ?? [],
      mode,
      tone,
      charLimit,
      projectContexts,
    })

    if (!result?.content || result.content.length < 10) {
      return jsonResponse(
        { ok: false, reason: "generation_error", error: "Generation failed" },
        req,
      )
    }

    const totalCommits = allRepoData.reduce((sum, r) => sum + r.commits.length, 0)
    const totalPrs = allRepoData.reduce((sum, r) => sum + r.mergedPrs.length, 0)
    const totalReleases = allRepoData.reduce((sum, r) => sum + r.releases.length, 0)

    const sourceData: Record<string, unknown> = {
      mode,
      repos: allRepoData.map((r) => r.repoName),
      commit_count: totalCommits,
      pr_count: totalPrs,
      release_count: totalReleases,
      published_post_ids: (recentPosts ?? []).map((p: { created_at: string }) => p.created_at),
      window: "7d",
      generated_at: new Date().toISOString(),
    }
    if (targetRepo) sourceData.repo = targetRepo
    if (targetBranch) sourceData.branch = targetBranch

    const { data: post, error: insertError } = await supabase
      .from("posts")
      .insert({
        user_id: user.id,
        source_type: "recap",
        source_data: sourceData,
        content: result.content,
        original_content: result.content,
        status: "draft",
      })
      .select("id, content, source_type, status, created_at")
      .single()

    if (insertError) {
      log.error("failed to insert recap: {error}", { error: insertError.message })
      return jsonResponse(
        { ok: false, reason: "generation_error", error: insertError.message },
        req,
      )
    }

    log.info("generated {mode} recap for user {userId}: {postId}", {
      mode,
      userId: user.id,
      postId: post.id,
    })
    return jsonResponse({ ok: true, post }, req)
  } catch (err) {
    log.error("recap generation failed: {error}", { error: String(err) })
    return jsonResponse(
      {
        ok: false,
        reason: "generation_error",
        error: err instanceof Error ? err.message : String(err),
      },
      req,
    )
  }
})
