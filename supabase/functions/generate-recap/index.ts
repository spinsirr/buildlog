import { requireUser } from "../_shared/auth.ts"
import { generateWithRetry } from "../_shared/ai.ts"
import { fetchRepoRecapData } from "../_shared/github.ts"
import type { RepoRecapData } from "../_shared/github.ts"
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts"
import { getLog, setupLogger } from "../_shared/logger.ts"

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

  try {
    // Parse request body
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

    const since = new Date(
      Date.now() - RECAP_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString()

    // 1. Dedup check
    const now = new Date()

    if (mode === "week") {
      // Monday-aligned weekly dedup
      const monday = new Date(now)
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
      monday.setHours(0, 0, 0, 0)

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
      // Branch dedup — check for same repo+branch this week
      const monday = new Date(now)
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
      monday.setHours(0, 0, 0, 0)

      const { data: existingBranchRecaps } = await supabase
        .from("posts")
        .select("id, source_data")
        .eq("user_id", user.id)
        .eq("source_type", "recap")
        .gte("created_at", monday.toISOString())

      const hasDupe = existingBranchRecaps?.some((p) => {
        const sd = p.source_data as Record<string, unknown> | null
        return sd?.repo === targetRepo && sd?.branch === targetBranch
      })
      if (hasDupe) {
        return jsonResponse({ ok: false, reason: "recap_exists" }, req)
      }
    }

    // 2. Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("tone, x_premium, github_installation_id")
      .eq("id", user.id)
      .single()

    const tone = profile?.tone ?? "casual"
    const charLimit = profile?.x_premium ? 4000 : 280
    const installationId = profile?.github_installation_id as number | null

    // 3. Fetch GitHub activity (primary data source)
    let allRepoData: RepoRecapData[] = []
    const projectContexts = new Map<string, string>()

    if (installationId) {
      if (mode === "branch" && targetRepo) {
        // Branch mode: single repo, branch-scoped
        const data = await fetchRepoRecapData(
          installationId,
          targetRepo,
          since,
          targetBranch,
        )
        allRepoData = [data]
      } else {
        // Week mode: all active connected repos
        const { data: repos } = await supabase
          .from("connected_repos")
          .select("full_name, project_context")
          .eq("user_id", user.id)
          .eq("is_active", true)

        if (repos && repos.length > 0) {
          // Store project contexts
          for (const r of repos) {
            if (r.project_context) {
              projectContexts.set(r.full_name, r.project_context)
            }
          }

          // Fetch in parallel, cap at 5 repos
          const repoSlice = repos.slice(0, 5)
          const results = await Promise.allSettled(
            repoSlice.map((r) => fetchRepoRecapData(installationId, r.full_name, since)),
          )
          allRepoData = results
            .filter(
              (r): r is PromiseFulfilledResult<RepoRecapData> => r.status === "fulfilled",
            )
            .map((r) => r.value)
        }
      }
    }

    // 4. Fetch supplementary internal data
    const { data: bundles } = await supabase
      .from("post_decisions")
      .select(
        "id, source_type, source_data, reason, angle, confidence, repo_id, created_at",
      )
      .eq("user_id", user.id)
      .eq("decision", "bundle_later")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20)

    const { data: recentPosts } = await supabase
      .from("posts")
      .select("id, content, source_type, source_data, repo_id, created_at")
      .eq("user_id", user.id)
      .in("status", ["published", "draft"])
      .neq("source_type", "recap")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20)

    // 5. Check if we have any data at all
    const hasGitHubData = allRepoData.some(
      (r) =>
        r.commits.length > 0 ||
        r.mergedPrs.length > 0 ||
        r.releases.length > 0,
    )
    const hasBundles = (bundles?.length ?? 0) > 0
    const hasPosts = (recentPosts?.length ?? 0) > 0

    if (!hasGitHubData && !hasBundles && !hasPosts) {
      return jsonResponse({ ok: false, reason: "no_activity" }, req)
    }

    // 6. Build prompts + generate
    const systemPrompt = buildRecapSystemPrompt(tone, charLimit, mode)
    const userPrompt = buildRecapUserPrompt(
      allRepoData,
      bundles ?? [],
      recentPosts ?? [],
      mode,
      projectContexts,
    )

    const content = await generateWithRetry(systemPrompt, userPrompt, charLimit, {
      maxOutputTokens: profile?.x_premium ? 2000 : 800,
      temperature: 0.8,
      retryTemperature: 0.5,
    })

    if (content.length < 10) {
      return jsonResponse(
        {
          ok: false,
          reason: "generation_error",
          error: "Generated content was too short",
        },
        req,
      )
    }

    // 7. Insert recap draft
    const totalCommits = allRepoData.reduce(
      (sum, r) => sum + r.commits.length,
      0,
    )
    const totalPrs = allRepoData.reduce(
      (sum, r) => sum + r.mergedPrs.length,
      0,
    )
    const totalReleases = allRepoData.reduce(
      (sum, r) => sum + r.releases.length,
      0,
    )

    const sourceData: Record<string, unknown> = {
      "mode": mode,
      "repos": allRepoData.map((r) => r.repoName),
      "commit_count": totalCommits,
      "pr_count": totalPrs,
      "release_count": totalReleases,
      "bundled_decision_ids": (bundles ?? []).map(
        (b: { id: string }) => b.id,
      ),
      "published_post_ids": (recentPosts ?? []).map(
        (p: { id: string }) => p.id,
      ),
      "window": "7d",
      "generated_at": new Date().toISOString(),
    }
    if (targetRepo) sourceData["repo"] = targetRepo
    if (targetBranch) sourceData["branch"] = targetBranch

    const { data: post, error: insertError } = await supabase
      .from("posts")
      .insert({
        user_id: user.id,
        source_type: "recap",
        source_data: sourceData,
        content,
        original_content: content,
        status: "draft",
      })
      .select("id, content, source_type, status, created_at")
      .single()

    if (insertError) {
      log.error("failed to insert recap: {error}", {
        error: insertError.message,
      })
      return jsonResponse(
        {
          ok: false,
          reason: "generation_error",
          error: insertError.message,
        },
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

// ---------------------------------------------------------------------------
// Prompt builders (duplicated from lib/recap-prompts.ts for Deno compat)
// ---------------------------------------------------------------------------

interface BundleDecision {
  id: string
  "source_type": string
  "source_data": Record<string, unknown>
  reason: string
  angle: string | null
  "created_at": string
}

interface RecentPost {
  id: string
  content: string
  "source_type": string
  "source_data": Record<string, unknown> | null
  "created_at": string
}

interface RecapCommit {
  message: string
  author: string
}

interface RecapPr {
  number: number
  title: string
  additions: number
  deletions: number
}

interface RecapRelease {
  "tag_name": string
  name: string
  body: string | null
}

interface RepoRecapActivity {
  "repoName": string
  commits: RecapCommit[]
  "mergedPrs": RecapPr[]
  releases: RecapRelease[]
}

const toneInstructions: Record<string, string> = {
  casual: "Use a friendly, conversational tone. Sound like a developer tweeting to friends.",
  professional:
    "Use a polished, professional tone. Sound like a founder giving a confident product update.",
  technical: "Use a technical tone with specifics. Sound like a senior engineer sharing knowledge.",
}

function buildRecapSystemPrompt(
  tone: string,
  charLimit: number,
  mode: "week" | "branch",
): string {
  const modeFraming = mode === "branch"
    ? `You are writing a social media post about progress on a specific feature branch. Focus on what was built, the progression of work, and the end result.`
    : `You are writing a weekly recap for a developer's "build in public" social media. Weave all activity into a coherent narrative about what was shipped this week.`

  return `${modeFraming}

TONE:
${toneInstructions[tone] ?? toneInstructions.casual}

CRITICAL RULES:
- MUST be under ${charLimit} characters
- ${
    mode === "branch"
      ? "Focus on the feature story — what problem it solves, what changed"
      : "Highlight the overall theme or direction of the week"
  }
- Mention 2-4 key things shipped or worked on
- End with 1-2 relevant hashtags
- Sound like a real person, not a bot
- Do NOT expose file names, function names, or internal architecture
- Talk about what the USER can now do or what PROGRESS was made
- If there are merged PRs, prefer talking about those over individual commits
- ${
    mode === "branch"
      ? "This is about ONE feature branch — keep it focused"
      : "This is a WEEKLY SUMMARY, not individual updates"
  }

Output ONLY the post text, nothing else.`
}

const MAX_COMMITS_PER_REPO = 15

function buildRecapUserPrompt(
  repoData: RepoRecapActivity[],
  bundles: BundleDecision[],
  posts: RecentPost[],
  mode: "week" | "branch",
  projectContexts?: Map<string, string>,
): string {
  const parts: string[] = []

  // Primary: GitHub activity
  const reposWithData = repoData.filter(
    (r) =>
      r.commits.length > 0 ||
      r.mergedPrs.length > 0 ||
      r.releases.length > 0,
  )

  if (reposWithData.length > 0) {
    const header = mode === "branch" ? "BRANCH ACTIVITY:" : "GITHUB ACTIVITY THIS WEEK:"
    const repoSections = reposWithData.map((repo) => {
      const lines: string[] = [`## ${repo.repoName}`]

      const ctx = projectContexts?.get(repo.repoName)
      if (ctx) lines.push(ctx)

      const filteredCommits = repo.commits
        .filter((c) => !c.message.startsWith("Merge "))
        .slice(0, MAX_COMMITS_PER_REPO)

      if (filteredCommits.length > 0) {
        lines.push(`\nCommits (${filteredCommits.length}):`)
        for (const c of filteredCommits) {
          lines.push(`- ${c.message} (by ${c.author})`)
        }
      }

      if (repo.mergedPrs.length > 0) {
        lines.push(`\nMerged PRs (${repo.mergedPrs.length}):`)
        for (const pr of repo.mergedPrs) {
          lines.push(
            `- PR #${pr.number}: ${pr.title} (+${pr.additions} -${pr.deletions})`,
          )
        }
      }

      if (repo.releases.length > 0) {
        lines.push(`\nReleases (${repo.releases.length}):`)
        for (const r of repo.releases) {
          const desc = r.body ? ` — ${r.body.slice(0, 200)}` : ""
          lines.push(`- ${r.tag_name}: ${r.name}${desc}`)
        }
      }

      return lines.join("\n")
    })

    parts.push(`${header}\n\n${repoSections.join("\n\n")}`)
  }

  // Secondary: internal data
  if (bundles.length > 0) {
    const bundleLines = bundles.map((b) => {
      const msg = (b.source_data?.message ?? b.source_data?.title ??
        "unknown change") as string
      return `- [${b.source_type}] ${msg} — reason deferred: "${b.reason}"${
        b.angle ? ` (angle: ${b.angle})` : ""
      }`
    })
    parts.push(
      `BUNDLED EVENTS (deferred from individual posts, not yet shared publicly):\n${
        bundleLines.join("\n")
      }`,
    )
  }

  if (posts.length > 0) {
    const postLines = posts.map((p) => `- "${p.content}"`)
    parts.push(`ALREADY SHARED THIS WEEK:\n${postLines.join("\n")}`)
  }

  const instruction = mode === "branch"
    ? "Generate ONE post summarizing what was built on this branch."
    : "Generate ONE weekly recap post that covers the full week."
  parts.push(instruction)

  return parts.join("\n\n")
}
