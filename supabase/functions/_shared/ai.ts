import { getLog } from "./logger.ts"

const log = getLog("ai")

interface FileDiff {
  filename: string
  status: string
  additions: number
  deletions: number
  patch?: string
}

interface GeneratePostInput {
  sourceType: "commit" | "pr" | "release" | "tag"
  repoName: string
  tone?: "casual" | "professional" | "technical"
  projectContext?: string | null
  data: {
    message?: string
    title?: string
    description?: string
    files?: string[]
    url?: string
    additions?: number
    deletions?: number
    filesChanged?: number
    commitMessages?: string[]
    diffs?: FileDiff[]
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
    "Dark mode just landed on the dashboard. Looks clean. #devtools",
    "Fixed a login bug that was tripping up new signups. Should be smooth now. #shipping",
    "You can now export your data as CSV. Small feature, big ask. #productupdate",
  ],
  professional: [
    "Shipped a new onboarding flow — time-to-value cut significantly. Better first impressions = better retention. #saas #shipping",
    "Released v2.1 with performance improvements across the board. Faster API, snappier UI. #devtools",
    "Role-based access control is now live. Granular permissions for teams that need them. #saas #enterprise",
  ],
  technical: [
    "Migrated auth to session tokens with HTTP-only cookies. Better security without sacrificing speed. #security #webdev",
    "Query layer now uses prepared statements with connection pooling. Latency dropped dramatically. #postgres #performance",
    "Added streaming SSR with Server Components. First paint is noticeably faster on the dashboard. #react #performance",
  ],
}

function classifyChange(input: GeneratePostInput): string {
  const msg = (input.data.message ?? input.data.title ?? "").toLowerCase()
  const files = input.data.files ?? []

  if (msg.startsWith("fix") || msg.includes("bug") || msg.includes("hotfix")) return "bugfix"
  if (
    msg.startsWith("feat") ||
    msg.includes("add") ||
    msg.includes("implement") ||
    msg.includes("new")
  ) {
    return "feature"
  }
  if (msg.startsWith("refactor") || msg.includes("clean") || msg.includes("reorganize")) {
    return "refactor"
  }
  if (msg.includes("test") || msg.includes("spec")) return "testing"
  if (msg.includes("doc") || msg.includes("readme")) return "docs"
  if (msg.includes("perf") || msg.includes("optim") || msg.includes("speed")) return "performance"
  if (
    msg.includes("style") || msg.includes("ui") || msg.includes("css") || msg.includes("design")
  ) {
    return "ui"
  }
  if (msg.includes("deploy") || msg.includes("ci") || msg.includes("pipeline")) return "devops"

  const fileStr = files.join(" ").toLowerCase()
  if (fileStr.includes("test") || fileStr.includes("spec")) return "testing"
  if (fileStr.includes(".md") || fileStr.includes("doc")) return "docs"
  if (fileStr.includes(".css") || fileStr.includes("style") || fileStr.includes("component")) {
    return "ui"
  }

  return "general"
}

function buildChangeContext(input: GeneratePostInput): string {
  const parts: string[] = []

  if (input.data.additions !== undefined || input.data.deletions !== undefined) {
    const adds = input.data.additions ?? 0
    const dels = input.data.deletions ?? 0
    parts.push(`Scale: +${adds} -${dels} lines across ${input.data.filesChanged ?? "?"} files`)
  }

  if (input.data.commitMessages && input.data.commitMessages.length > 0) {
    const msgs = input.data.commitMessages.slice(0, 15).join("\n- ")
    parts.push(`Commit history:\n- ${msgs}`)
  }

  // Include actual code diffs — this is the richest context for understanding what changed
  if (input.data.diffs && input.data.diffs.length > 0) {
    const diffSections = input.data.diffs
      .filter((d) => d.patch)
      .map((d) => `--- ${d.filename} (${d.status}, +${d.additions} -${d.deletions})\n${d.patch}`)
    if (diffSections.length > 0) {
      parts.push(`Code changes:\n${diffSections.join("\n\n")}`)
    }
  } else if (input.data.files && input.data.files.length > 0) {
    // Fallback to file list if no diffs available
    const fileList = input.data.files.slice(0, 20).join("\n- ")
    parts.push(
      `Files touched:\n- ${fileList}${
        input.data.files.length > 20 ? `\n  (+${input.data.files.length - 20} more)` : ""
      }`,
    )
  }

  return parts.length > 0 ? `\n\n${parts.join("\n\n")}` : ""
}

interface GeminiResult {
  text: string
  truncated: boolean
}

async function callGeminiOnce(url: string, body: string): Promise<GeminiResult> {
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
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> }
        finishReason?: string
      }>
    }

    const text = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim()
    if (!text) throw new Error("Gemini response was empty")

    const finishReason = data.candidates?.[0]?.finishReason
    const truncated = finishReason === "MAX_TOKENS"

    return { text, truncated }
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

async function callGemini(
  system: string,
  prompt: string,
  opts?: { maxOutputTokens?: number; temperature?: number },
): Promise<GeminiResult> {
  const apiKey = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_API_KEY")
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY (or GOOGLE_API_KEY)")
  }

  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-3-flash-preview"

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
      temperature: opts?.temperature ?? 0.8,
      topP: 0.95,
      maxOutputTokens: opts?.maxOutputTokens ?? 220,
    },
  })

  try {
    return await callGeminiOnce(url, body)
  } catch (err) {
    if (isTransient(err)) {
      log.warn("Gemini transient error, retrying once: {error}", { error: String(err) })
      return await callGeminiOnce(url, body)
    }
    throw err
  }
}

export async function generateXhsPost(input: GeneratePostInput): Promise<string> {
  const changeType = classifyChange(input)
  const changeContext = buildChangeContext(input)

  let context: string
  if (input.sourceType === "commit") {
    context = `Commit in ${input.repoName}: "${input.data.message}"${changeContext}`
  } else if (input.sourceType === "pr") {
    const desc = input.data.description
      ? `\nPR description: ${input.data.description.slice(0, 1000)}`
      : ""
    context = `PR merged in ${input.repoName}: "${input.data.title}"${changeContext}${desc}`
  } else if (input.sourceType === "release") {
    const desc = input.data.description
      ? `\nRelease notes: ${input.data.description.slice(0, 1000)}`
      : ""
    context = `New release in ${input.repoName}: ${input.data.title}${desc}${changeContext}`
  } else {
    context = `New tag in ${input.repoName}: ${input.data.title}${changeContext}`
  }

  const changeTypeHints: Record<string, string> = {
    bugfix: "这是一个Bug修复，强调解决了什么问题以及修复过程中的心得。",
    feature: "这是一个新功能，突出用户现在可以做什么。",
    refactor: "这是代码重构，强调代码质量和开发体验的提升。",
    testing: "这是测试相关的更新，强调代码质量和可靠性。",
    docs: "这是文档更新，强调好文档的价值。",
    performance: "这是性能优化，突出具体的性能提升数据。",
    ui: "这是UI/设计变更，描述视觉或用户体验的改善。",
    devops: "这是DevOps/CI变更，强调部署或基础设施的改进。",
    general: "描述构建、修改或发布了什么。",
  }

  const system = `你是一个技术内容作者，帮开发团队把代码变更转化为小红书风格的产品动态。

核心原则：
- 严格基于提供的代码变更信息写作，绝对不要编造任何没有发生的事情
- 不要虚构故事、翻车经历、踩坑过程或任何不在上下文中的细节
- 如果上下文信息有限，就写简短的更新，不要用虚构内容来凑字数

格式规则：
- 字数控制在 200-500 字符
- 第一行是标题，用 emoji 开头，简洁有力
- 正文分段，每段用 emoji 作为小标题或要点标记
- 语气简洁专业，像产品更新公告
- 适当使用 emoji（3-6个），不要堆砌
- 结尾加 2-4 个话题标签，格式为 #话题#
- 常用话题：#程序员日常# #独立开发# #技术分享# #产品更新#
- 不要包含 URL 链接
- 不要用 Markdown 格式
- 只输出文案内容，不要其他说明

上下文提示：
${changeTypeHints[changeType]}

输出纯文本文案。`

  const projectBlock = input.projectContext
    ? `\n\n项目背景（仅供理解，不要直接暴露原始细节）：\n${input.projectContext.slice(0, 1500)}`
    : ""

  const prompt = `为以下开发动态生成一篇小红书文案：\n${context}${projectBlock}`

  const { text, truncated } = await callGemini(system, prompt, {
    maxOutputTokens: 600,
    temperature: 0.85,
  })
  let result = text.trim()

  if (truncated) {
    log.warn("XHS post was truncated by model, retrying")
    const retry = await callGemini(
      system,
      `${prompt}

IMPORTANT: Write a COMPLETE post. Do not end mid-sentence.`,
      { maxOutputTokens: 800, temperature: 0.5 },
    )
    result = retry.text.trim()
  }

  return result
}

/**
 * Expand a short-form post (tweet) into a LinkedIn-appropriate post.
 * Called at publish time — takes the existing content and rewrites it
 * for LinkedIn's longer format and professional audience.
 */
export async function expandForLinkedIn(tweetContent: string): Promise<string> {
  const system = `You are a content writer for developer tools companies on LinkedIn.

YOUR JOB: Take a short tweet-style post and expand it into a LinkedIn post.

CRITICAL: Only describe what actually happened based on the tweet content. Do NOT invent stories, challenges, or lessons that aren't implied by the original post.

RULES:
- Target 600-1000 characters (significantly longer than the tweet)
- Professional but human tone — like a founder giving a confident product update
- Add relevant context or insight, but only if grounded in the original content
- Structure: hook line → what shipped/changed → why it matters
- No hashtags in the body — add 2-4 relevant hashtags at the very end, separated by spaces
- No emojis except sparingly (0-2 max)
- Do NOT include URLs
- Do NOT start with "I'm excited to announce" or similar clichés
- Do NOT fabricate technical details, metrics, or experiences not in the original
- Sound like a real founder, not a press release

Output ONLY the LinkedIn post text, nothing else.`

  const prompt = `Expand this tweet into a LinkedIn post:\n\n"${tweetContent}"`

  const { text } = await callGemini(system, prompt, {
    maxOutputTokens: 800,
    temperature: 0.7,
  })

  return text.trim()
}

export async function generatePost(input: GeneratePostInput): Promise<string> {
  const tone = input.tone ?? "casual"
  const changeType = classifyChange(input)
  const changeContext = buildChangeContext(input)

  let context: string
  if (input.sourceType === "commit") {
    context = `Commit in ${input.repoName}: "${input.data.message}"${changeContext}`
  } else if (input.sourceType === "pr") {
    const desc = input.data.description
      ? `\nPR description: ${input.data.description.slice(0, 1000)}`
      : ""
    context = `PR merged in ${input.repoName}: "${input.data.title}"${desc}${changeContext}`
  } else if (input.sourceType === "release") {
    const desc = input.data.description
      ? `\nRelease notes: ${input.data.description.slice(0, 1000)}`
      : ""
    context = `New release in ${input.repoName}: ${input.data.title}${desc}${changeContext}`
  } else {
    context = `New tag in ${input.repoName}: ${input.data.title}${changeContext}`
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

  const system = `You are a content writer for developer tools companies on Twitter/X.

YOUR JOB: Read the technical context below and write a concise post about what was SHIPPED. The context includes commit messages, file paths, and code details — these are for YOUR understanding only.

CRITICAL RULES:
- MUST be under 280 characters total (count carefully)
- Write exactly ONE complete post — never end mid-sentence or mid-thought
- The post MUST be a complete, well-formed sentence or paragraph
- Sound authentic and human — not like a bot or marketing copy
- No excessive emojis (0-2 max)
- End with 1-2 relevant hashtags
- Never start with "Just" for every post — vary your openings
- Do NOT include URLs — they will be added separately
- NEVER fabricate events, bugs, outages, or experiences that aren't in the provided context
- Only describe what actually happened based on the code changes provided

ABSOLUTELY NEVER EXPOSE:
- File names or paths (e.g. "auth.ts", "middleware", "components/")
- Function or variable names (e.g. "handleWebhook", "fetchToken")
- Package/library names (e.g. "Stripe SDK", "Supabase", "Prisma") unless it's the main product
- Technical jargon that non-developers wouldn't understand
- Internal architecture details (e.g. "edge function", "webhook handler", "OAuth flow")
- Specific error messages or status codes

INSTEAD, TALK ABOUT:
- What the USER can now do (new features, fixed bugs, better experience)
- The PROGRESS or milestone (shipped, improved, launched)
- Why this change matters for the product

TONE:
${toneInstructions[tone]}

CONTEXT HINT:
${changeTypeHints[changeType]}

EXAMPLES of good ${tone} posts:
${fewShotBlock}

Output ONLY the post text, nothing else.`

  // Inject project context so AI understands what this repo actually is
  const projectBlock = input.projectContext
    ? `\n\nProject background (for your understanding — do NOT expose raw details):\n${input.projectContext.slice(0, 1500)}`
    : ""

  const prompt = `Generate a shipping update post for this ${input.sourceType}:\n${context}${projectBlock}`

  const isComplete = (text: string) =>
    /[.!?](\s*#\S+)*\s*$/.test(text) || /^#\S+\s*$/.test(text.split("\n").pop() || "")

  const initial = await callGemini(system, prompt, { maxOutputTokens: 800, temperature: 0.7 })
  let result = initial.text.trim()

  // Retry if model hit token limit (truncated) or post looks incomplete
  if (initial.truncated || (!isComplete(result) && result.length < 280)) {
    log.warn("Post was {reason}, retrying", {
      reason: initial.truncated ? "truncated by MAX_TOKENS" : "incomplete",
    })
    const retry = await callGemini(
      system,
      `${prompt}\n\nIMPORTANT: Your previous attempt was cut off: "${result}". Write a COMPLETE post that ends with a proper sentence and hashtags. Do not end mid-word or mid-thought.`,
      { maxOutputTokens: 800, temperature: 0.5 },
    )
    if (isComplete(retry.text.trim()) && retry.text.trim().length <= 280) result = retry.text.trim()
  }

  // If AI exceeded 280 chars, re-generate with stricter instruction
  if (result.length > 280) {
    const retry = await callGemini(
      system,
      `${prompt}\n\nIMPORTANT: Your previous attempt was ${result.length} characters. Rewrite it to fit under 280 characters while keeping it complete and engaging.`,
      { maxOutputTokens: 800, temperature: 0.5 },
    )
    result = retry.text.trim().length <= 280 ? retry.text.trim() : result.slice(0, 279) + "…"
  }

  return result
}
