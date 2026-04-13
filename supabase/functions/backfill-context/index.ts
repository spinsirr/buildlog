/**
 * One-off function: backfill project_context + intro posts for ALL connected repos.
 * Uses service role — no user auth needed. Call once, then delete.
 */
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts"
import { fetchRepoContext } from "../_shared/github.ts"
import { createServiceClient } from "../_shared/supabase.ts"
import { callVercelAi } from "../_shared/vercel-ai.ts"

Deno.serve(async (req) => {
  const optRes = handleOptions(req)
  if (optRes) return optRes

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, req)
  }

  const supabase = createServiceClient()

  // Get all active repos with their owner's installation ID
  const { data: repos, error: repoErr } = await supabase
    .from("connected_repos")
    .select(
      "id, full_name, github_repo_id, project_context, user_id, profiles!inner(github_installation_id)",
    )
    .eq("is_active", true)

  if (repoErr) return errorResponse(`DB error: ${repoErr.message}`, 500, req)
  if (!repos || repos.length === 0) {
    return jsonResponse({ message: "No connected repos", updated: 0 }, req)
  }

  const results: Array<
    { repo: string; context: boolean; intro: boolean; error?: string }
  > = []

  for (const repo of repos) {
    const entry: {
      repo: string
      context: boolean
      intro: boolean
      error?: string
    } = {
      repo: repo.full_name,
      context: false,
      intro: false,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const installationId = (repo as Record<string, unknown> & {
      profiles?: { github_installation_id?: number }
    })
      .profiles?.github_installation_id
    if (!installationId) {
      entry.error = "no installation_id"
      results.push(entry)
      continue
    }

    // Skip if already has context
    if (repo.project_context) {
      entry.context = true

      // Still check if intro post is missing
      const { data: existing } = await supabase
        .from("posts")
        .select("id")
        .eq("repo_id", repo.id)
        .eq("source_type", "intro")
        .limit(1)

      if (!existing || existing.length === 0) {
        const result = await callVercelAi<{ content: string }>("intro", {
          repoName: repo.full_name,
          projectContext: repo.project_context,
        })
        if (result?.content) {
          await supabase.from("posts").insert({
            user_id: repo.user_id,
            repo_id: repo.id,
            source_type: "intro",
            content: result.content,
            status: "draft",
          })
          entry.intro = true
        } else {
          entry.error = "intro generation failed"
        }
      }

      results.push(entry)
      continue
    }

    try {
      const ctx = await fetchRepoContext(installationId, repo.full_name)
      if (ctx) {
        await supabase
          .from("connected_repos")
          .update({ project_context: ctx })
          .eq("id", repo.id)

        entry.context = true

        // Generate intro post
        const { data: existing } = await supabase
          .from("posts")
          .select("id")
          .eq("repo_id", repo.id)
          .eq("source_type", "intro")
          .limit(1)

        if (!existing || existing.length === 0) {
          const result = await callVercelAi<{ content: string }>("intro", {
            repoName: repo.full_name,
            projectContext: ctx,
          })
          if (result?.content) {
            await supabase.from("posts").insert({
              user_id: repo.user_id,
              repo_id: repo.id,
              source_type: "intro",
              content: result.content,
              status: "draft",
            })
            entry.intro = true
          }
        }
      } else {
        entry.error = "no context found (no README or manifest)"
      }
    } catch (err) {
      entry.error = String(err)
    }

    results.push(entry)
  }

  return jsonResponse({
    results,
    updated: results.filter((r) => r.context).length,
  }, req)
})
