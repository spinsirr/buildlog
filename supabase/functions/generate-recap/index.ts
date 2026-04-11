import { requireUser } from "../_shared/auth.ts"
import { generateWithRetry } from "../_shared/ai.ts"
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
    const since = new Date(Date.now() - RECAP_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

    // 1. Check for existing recap this week (Monday-aligned UTC)
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    monday.setHours(0, 0, 0, 0)

    const { count: existingRecap } = await supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("source_type", "recap")
      .gte("created_at", monday.toISOString())

    if ((existingRecap ?? 0) > 0) {
      return jsonResponse({ ok: false, reason: "recap_exists" }, req)
    }

    // 2. Fetch bundle_later decisions from last 7 days
    const { data: bundles } = await supabase
      .from("post_decisions")
      .select("id, source_type, source_data, reason, angle, confidence, repo_id, created_at")
      .eq("user_id", user.id)
      .eq("decision", "bundle_later")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20)

    // 3. Fetch published + draft posts from last 7 days
    const { data: recentPosts } = await supabase
      .from("posts")
      .select("id, content, source_type, source_data, repo_id, created_at")
      .eq("user_id", user.id)
      .in("status", ["published", "draft"])
      .neq("source_type", "recap")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20)

    const hasBundles = (bundles?.length ?? 0) > 0
    const hasPosts = (recentPosts?.length ?? 0) > 0

    if (!hasBundles && !hasPosts) {
      return jsonResponse({ ok: false, reason: "no_activity" }, req)
    }

    // 4. Get user profile for tone + x_premium
    const { data: profile } = await supabase
      .from("profiles")
      .select("tone, x_premium")
      .eq("id", user.id)
      .single()

    const tone = profile?.tone ?? "casual"
    const charLimit = profile?.x_premium ? 4000 : 280

    // 5. Build prompt + generate via shared helper
    const systemPrompt = buildRecapSystemPrompt(tone, charLimit)
    const userPrompt = buildRecapUserPrompt(bundles ?? [], recentPosts ?? [])

    const content = await generateWithRetry(systemPrompt, userPrompt, charLimit, {
      maxOutputTokens: profile?.x_premium ? 2000 : 800,
      temperature: 0.8,
      retryTemperature: 0.5,
    })

    if (content.length < 10) {
      return jsonResponse(
        { ok: false, reason: "generation_error", error: "Generated content was too short" },
        req,
      )
    }

    // 6. Insert recap draft
    const sourceData = {
      "bundled_decision_ids": (bundles ?? []).map((b: { id: string }) => b.id),
      "published_post_ids": (recentPosts ?? []).map((p: { id: string }) => p.id),
      "window": "7d",
      "generated_at": new Date().toISOString(),
    }

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
      log.error("failed to insert recap: {error}", { error: insertError.message })
      return jsonResponse(
        { ok: false, reason: "generation_error", error: insertError.message },
        req,
      )
    }

    log.info("generated recap for user {userId}: {postId}", {
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
// Prompt builders
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

const toneInstructions: Record<string, string> = {
  casual: "Use a friendly, conversational tone. Sound like a developer tweeting to friends.",
  professional:
    "Use a polished, professional tone. Sound like a founder giving a confident product update.",
  technical: "Use a technical tone with specifics. Sound like a senior engineer sharing knowledge.",
}

function buildRecapSystemPrompt(tone: string, charLimit: number): string {
  return `You are a weekly recap writer for a developer's "build in public" social media.

TONE:
${toneInstructions[tone] ?? toneInstructions.casual}

YOUR JOB: Read the developer's week of activity below and write a single recap post summarizing what they shipped. Weave bundled (deferred) events into a coherent narrative alongside already-published updates.

CRITICAL RULES:
- MUST be under ${charLimit} characters
- Highlight the overall theme or direction of the week
- Mention 2-4 key things shipped or worked on
- End with 1-2 relevant hashtags
- Sound like a real person, not a bot
- Do NOT expose file names, function names, or internal architecture
- Talk about what the USER can now do or what PROGRESS was made
- If there are bundled events, weave them into the narrative naturally
- This is a WEEKLY SUMMARY, not individual updates

Output ONLY the post text, nothing else.`
}

function buildRecapUserPrompt(
  bundles: BundleDecision[],
  posts: RecentPost[],
): string {
  const parts: string[] = []

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
    parts.push(
      `ALREADY SHARED THIS WEEK:\n${postLines.join("\n")}`,
    )
  }

  parts.push("Generate ONE weekly recap post that covers the full week.")
  return parts.join("\n\n")
}
