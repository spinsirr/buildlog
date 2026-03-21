interface GeneratePostInput {
  sourceType: "commit" | "pr" | "release"
  repoName: string
  tone?: "casual" | "professional" | "technical"
  data: {
    message?: string
    title?: string
    description?: string
    files?: string[]
    url?: string
    additions?: number
    deletions?: number
    filesChanged?: number
  }
}

const toneInstructions: Record<string, string> = {
  casual: `Use a friendly, conversational tone. Be relatable and approachable.
Sound like a developer tweeting to friends - natural, enthusiastic but not over-the-top.`,
  professional: `Use a polished, professional tone. Be clear and authoritative.
Sound like a founder giving a confident product update - concise, credible, forward-looking.`,
  technical: `Use a technical tone with specifics. Include technical details and terminology.
Sound like a senior engineer sharing knowledge - precise, insightful, educational.`,
}

const toneExamples: Record<string, string[]> = {
  casual: [
    "Just shipped dark mode for the dashboard. Took way longer than expected but the result is clean. #buildinpublic",
    "Finally fixed that auth bug that's been haunting me for 2 days. Turns out it was a missing await. Classic. #buildinpublic #webdev",
    "New feature dropped: you can now export your data as CSV. Small win but users have been asking for this forever. #buildinpublic",
  ],
  professional: [
    "Shipped a new onboarding flow that reduces time-to-value by 40%. Better first impressions = better retention. #buildinpublic",
    "Released v2.1 with performance improvements across the board. API response times down 60% after switching to edge functions. #buildinpublic",
    "Implemented role-based access control this week. Enterprise customers need granular permissions, and we now deliver. #buildinpublic #saas",
  ],
  technical: [
    "Migrated our auth from JWT to session tokens with HTTP-only cookies. Eliminated XSS token theft vector while keeping <50ms auth checks. #buildinpublic #security",
    "Refactored the query layer to use prepared statements with connection pooling. P99 latency dropped from 120ms to 18ms. #buildinpublic #postgres",
    "Added streaming SSR with React Server Components. TTFB went from 800ms to 120ms on the dashboard. The architecture shift was worth it. #buildinpublic",
  ],
}

function classifyChange(input: GeneratePostInput): string {
  const msg = (input.data.message ?? input.data.title ?? "").toLowerCase()
  const files = input.data.files ?? []

  if (msg.startsWith("fix") || msg.includes("bug") || msg.includes("hotfix")) return "bugfix"
  if (
    msg.startsWith("feat") || msg.includes("add") || msg.includes("implement") ||
    msg.includes("new")
  ) return "feature"
  if (msg.startsWith("refactor") || msg.includes("clean") || msg.includes("reorganize")) {
    return "refactor"
  }
  if (msg.includes("test") || msg.includes("spec")) return "testing"
  if (msg.includes("doc") || msg.includes("readme")) return "docs"
  if (msg.includes("perf") || msg.includes("optim") || msg.includes("speed")) return "performance"
  if (
    msg.includes("style") || msg.includes("ui") || msg.includes("css") || msg.includes("design")
  ) return "ui"
  if (msg.includes("deploy") || msg.includes("ci") || msg.includes("pipeline")) return "devops"

  const fileStr = files.join(" ").toLowerCase()
  if (fileStr.includes("test") || fileStr.includes("spec")) return "testing"
  if (fileStr.includes(".md") || fileStr.includes("doc")) return "docs"
  if (fileStr.includes(".css") || fileStr.includes("style") || fileStr.includes("component")) {
    return "ui"
  }

  return "general"
}

function buildDiffContext(input: GeneratePostInput): string {
  const parts: string[] = []

  if (input.data.additions !== undefined || input.data.deletions !== undefined) {
    const adds = input.data.additions ?? 0
    const dels = input.data.deletions ?? 0
    parts.push(`Changes: +${adds} -${dels} lines`)

    if (adds > 500) parts.push("(large change)")
    else if (adds < 20 && dels < 20) parts.push("(small, focused change)")
  }

  if (input.data.filesChanged !== undefined) {
    parts.push(`${input.data.filesChanged} file${input.data.filesChanged !== 1 ? "s" : ""} changed`)
  }

  if (input.data.files && input.data.files.length > 0) {
    const fileList = input.data.files.slice(0, 8).join(", ")
    parts.push(
      `Files: ${fileList}${
        input.data.files.length > 8 ? ` (+${input.data.files.length - 8} more)` : ""
      }`,
    )
  }

  return parts.length > 0 ? `\n${parts.join(" | ")}` : ""
}

async function callGeminiOnce(
  url: string,
  body: string,
): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text()
      const err = new Error(`Gemini API error: ${res.status} ${text}`)
      ;(err as Error & { status: number }).status = res.status
      throw err
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }

    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("")
      .trim()
    if (!text) throw new Error("Gemini response was empty")

    return text
  } finally {
    clearTimeout(timeout)
  }
}

function isTransient(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true
  if (err instanceof TypeError) return true // network error
  if (typeof (err as { status?: number }).status === "number") {
    return (err as { status: number }).status >= 500
  }
  return false
}

async function callGemini(system: string, prompt: string): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_API_KEY")
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY (or GOOGLE_API_KEY)")
  }

  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash"

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const body = JSON.stringify({
    system_instruction: {
      parts: [{ text: system }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.8,
      topP: 0.95,
      maxOutputTokens: 220,
    },
  })

  try {
    return await callGeminiOnce(url, body)
  } catch (err) {
    if (isTransient(err)) {
      console.warn("[ai] Gemini transient error, retrying once:", String(err))
      return await callGeminiOnce(url, body)
    }
    throw err
  }
}

export async function generatePost(input: GeneratePostInput): Promise<string> {
  const tone = input.tone ?? "casual"
  const changeType = classifyChange(input)
  const diffContext = buildDiffContext(input)

  let context: string
  if (input.sourceType === "commit") {
    context = `Commit in ${input.repoName}: "${input.data.message}"${diffContext}`
  } else if (input.sourceType === "pr") {
    const desc = input.data.description
      ? `\nPR description: ${input.data.description.slice(0, 500)}`
      : ""
    context = `PR merged in ${input.repoName}: "${input.data.title}"${desc}${diffContext}`
  } else {
    const desc = input.data.description
      ? `\nRelease notes: ${input.data.description.slice(0, 500)}`
      : ""
    context = `New release in ${input.repoName}: ${input.data.title}${desc}${diffContext}`
  }

  const examples = toneExamples[tone]
  const fewShotBlock = examples.map((ex, i) => `Example ${i + 1}: "${ex}"`).join("\n")

  const changeTypeHints: Record<string, string> = {
    bugfix: "This is a bug fix. Mention the problem solved and the relief of fixing it.",
    feature: "This is a new feature. Highlight what users can now do.",
    refactor:
      "This is a refactor/cleanup. Emphasize the improvement to code quality or developer experience.",
    testing: "This adds tests. Mention the value of reliability and confidence.",
    docs: "This is a docs update. Highlight the value of good documentation.",
    performance: "This is a performance improvement. Mention specific gains if available.",
    ui: "This is a UI/design change. Mention the visual or UX improvement.",
    devops: "This is a DevOps/CI change. Mention the deployment or infrastructure improvement.",
    general: "Describe what was built, changed, or shipped.",
  }

  const system = `You are an expert build-in-public content writer for developers on Twitter/X.

RULES:
- MUST be under 280 characters total (this is critical - count carefully)
- Write exactly ONE post, no alternatives
- Sound authentic and human - not like a bot or marketing copy
- No excessive emojis (0-2 max)
- Focus on what was built, learned, or shipped and why it matters
- End with 1-2 relevant hashtags (always include #buildinpublic)
- Never start with "Just" for every post - vary your openings
- Don't use quotes around the feature name
- If the commit message is a conventional commit (feat:, fix:, etc.), extract the meaningful part
- Do NOT include URLs - they will be added separately

TONE:
${toneInstructions[tone]}

CONTEXT HINT:
${changeTypeHints[changeType]}

EXAMPLES of good ${tone} posts:
${fewShotBlock}

Output ONLY the post text, nothing else.`

  const prompt = `Generate a build-in-public post for this ${input.sourceType}:\n${context}`

  let result = (await callGemini(system, prompt)).trim()

  const TWITTER_LIMIT = 280
  if (result.length > TWITTER_LIMIT) {
    const truncated = result.slice(0, TWITTER_LIMIT - 1)
    const lastSpace = truncated.lastIndexOf(" ")
    result = `${lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated}…`
  }

  return result
}
