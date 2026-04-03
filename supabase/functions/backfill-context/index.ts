/**
 * One-off function: backfill project_context + intro posts for existing connected repos.
 * Call once, then delete.
 */
import { generateIntroPost } from "../_shared/ai.ts"
import { requireUser } from "../_shared/auth.ts"
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts"
import { fetchRepoContext } from "../_shared/github.ts"

Deno.serve(async (req) => {
  const optRes = handleOptions(req)
  if (optRes) return optRes

  if (req.method !== "POST") return errorResponse("Method not allowed", 405, req)

  const { user, supabase, error: authErr } = await requireUser(req)
  if (!user) return errorResponse(authErr!, 401, req)

  // Get installation ID
  const { data: profile } = await supabase
    .from("profiles")
    .select("github_installation_id")
    .eq("id", user.id)
    .single()

  if (!profile?.github_installation_id) {
    return errorResponse("GitHub not connected", 400, req)
  }

  // Find repos missing context
  const { data: repos } = await supabase
    .from("connected_repos")
    .select("id, full_name, github_repo_id, project_context")
    .eq("user_id", user.id)
    .eq("is_active", true)

  if (!repos || repos.length === 0) {
    return jsonResponse({ message: "No connected repos", updated: 0 }, req)
  }

  const results: Array<{ repo: string; context: boolean; intro: boolean }> = []

  for (const repo of repos) {
    const entry: { repo: string; context: boolean; intro: boolean } = {
      repo: repo.full_name,
      context: false,
      intro: false,
    }

    // Skip if already has context
    if (repo.project_context) {
      entry.context = true
      results.push(entry)
      continue
    }

    try {
      const ctx = await fetchRepoContext(profile.github_installation_id, repo.full_name)
      if (ctx) {
        await supabase
          .from("connected_repos")
          .update({ project_context: ctx })
          .eq("id", repo.id)

        entry.context = true

        // Check if intro post already exists
        const { data: existing } = await supabase
          .from("posts")
          .select("id")
          .eq("repo_id", repo.id)
          .eq("source_type", "intro")
          .limit(1)

        if (!existing || existing.length === 0) {
          const content = await generateIntroPost(repo.full_name, ctx)
          await supabase.from("posts").insert({
            user_id: user.id,
            repo_id: repo.id,
            source_type: "intro",
            content,
            status: "draft",
          })
          entry.intro = true
        }
      }
    } catch {
      // continue to next repo
    }

    results.push(entry)
  }

  return jsonResponse({ results, updated: results.filter((r) => r.context).length }, req)
})
