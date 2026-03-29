import { getLog } from "../_shared/logger.ts"
import { createServiceClient } from "../_shared/supabase.ts"

const log = getLog("weekly-digest")

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS })
  }

  try {
    const supabase = createServiceClient()

    // Get all users with changelog enabled
    const { data: profiles, error: profilesErr } = await supabase
      .from("profiles")
      .select("id, github_username, changelog_slug")
      .eq("changelog_enabled", true)

    if (profilesErr) throw profilesErr
    if (!profiles?.length) {
      return Response.json({ ok: true, digests: 0 }, { headers: CORS })
    }

    // Date range: last 7 days
    const now = new Date()
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)

    const digests: Array<{ user: string; posts: number; summary: string }> = []

    for (const profile of profiles) {
      // Get posts from the last week
      const { data: posts, error: postsErr } = await supabase
        .from("posts")
        .select("content, source_type, created_at, connected_repos(full_name)")
        .eq("user_id", profile.id)
        .gte("created_at", weekAgo.toISOString())
        .order("created_at", { ascending: true })

      if (postsErr) {
        log.warn("Failed to fetch posts for {user}: {error}", {
          user: profile.github_username,
          error: postsErr.message,
        })
        continue
      }

      if (!posts?.length) continue

      // Generate digest summary using Gemini
      const postSummaries = posts.map((p) => {
        const repo = Array.isArray(p.connected_repos)
          ? p.connected_repos[0]?.full_name
          : p.connected_repos?.full_name
        return `- [${p.source_type}] ${p.content}${repo ? ` (${repo.split("/")[1]})` : ""}`
      })

      const summary = await generateDigest(postSummaries, profile.github_username ?? "developer")

      // Get Monday of this week for the digest key
      const monday = new Date(weekAgo)
      const day = monday.getDay()
      const diff = monday.getDate() - day + (day === 0 ? -6 : 1)
      monday.setDate(diff)
      const weekStart = monday.toISOString().slice(0, 10)

      // Upsert digest into DB
      const { error: upsertErr } = await supabase.from("weekly_digests").upsert(
        {
          user_id: profile.id,
          week_start: weekStart,
          summary,
          post_count: posts.length,
        },
        { onConflict: "user_id,week_start" },
      )

      if (upsertErr) {
        log.warn("Failed to save digest for {user}: {error}", {
          user: profile.github_username,
          error: upsertErr.message,
        })
      }

      digests.push({
        user: profile.github_username ?? profile.id,
        posts: posts.length,
        summary,
      })

      log.info("Generated digest for {user}: {count} posts", {
        user: profile.github_username,
        count: posts.length,
      })
    }

    return Response.json({ ok: true, digests: digests.length, data: digests }, { headers: CORS })
  } catch (err) {
    log.error("Digest generation failed: {error}", { error: String(err) })
    return Response.json({ error: String(err) }, { status: 500, headers: CORS })
  }
})

async function generateDigest(posts: string[], username: string): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_API_KEY")
  if (!apiKey) {
    // Fallback: just list the posts
    return posts.join("\n")
  }

  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-3-flash-preview"
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const system =
    `You are a concise shipping report writer. Given a list of things a developer shipped this week, produce a brief weekly digest (3-8 bullet points) that summarizes what was accomplished in plain language.

Rules:
- Group related changes together (don't list each commit separately)
- Use product/user language, not technical jargon
- Each bullet should be one clear sentence
- Start each bullet with a verb (Added, Fixed, Improved, Shipped, etc.)
- Include the overall theme/narrative if there is one
- No headers, no intro, no outro — just the bullets
- Use markdown bullet format (- )
- Keep it under 500 characters total`

  const prompt =
    `Generate a weekly shipping digest for ${username}. Here are the individual updates from this week:\n\n${
      posts.join("\n")
    }`

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 400 },
    }),
  })

  if (!res.ok) {
    log.warn("Gemini digest failed: {status}", { status: res.status })
    return posts.join("\n")
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }

  return (
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ??
      posts.join("\n")
  )
}
