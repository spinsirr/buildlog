import { getLog } from "./logger.ts"

const log = getLog("ai")

interface GeneratePostInput {
  sourceType: "commit" | "pr" | "release" | "tag"
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
    commitMessages?: string[]
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

  if (input.data.files && input.data.files.length > 0) {
    const fileList = input.data.files.slice(0, 20).join("\n- ")
    parts.push(
      `Files touched:\n- ${fileList}${
        input.data.files.length > 20 ? `\n  (+${input.data.files.length - 20} more)` : ""
      }`,
    )
  }

  return parts.length > 0 ? `\n\n${parts.join("\n\n")}` : ""
}

async function callGeminiOnce(url: string, body: string): Promise<string> {
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

    const text = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
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

async function callGemini(
  system: string,
  prompt: string,
  opts?: { maxOutputTokens?: number; temperature?: number },
): Promise<string> {
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

  const system = `你是一个专业的小红书技术博主，擅长用小红书风格写开发者的 build-in-public 内容。

规则：
- 字数控制在 300-800 字符
- 第一行是标题，用 emoji 开头，简洁有力
- 正文分段，每段用 emoji 作为小标题或要点标记
- 语气真诚、接地气，像在跟朋友分享开发日常
- 适当使用 emoji 装饰（5-10个），但不要堆砌
- 结尾加 3-5 个小红书话题标签，格式为 #话题#
- 常用话题：#程序员日常# #独立开发# #开源项目# #技术分享# #BuildInPublic#
- 可以加一些个人感想、踩坑经验、学到的东西
- 不要包含 URL 链接
- 不要用 Markdown 格式
- 只输出文案内容，不要其他说明

上下文提示：
${changeTypeHints[changeType]}

输出纯文本文案。`

  const prompt = `为以下开发动态生成一篇小红书文案：\n${context}`

  const result = (await callGemini(system, prompt, { maxOutputTokens: 600, temperature: 0.85 }))
    .trim()
  return result
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

  const system = `You are an expert build-in-public content writer for developers on Twitter/X.

YOUR JOB: Read the technical context below and translate it into an engaging, human post about what was BUILT or SHIPPED. The context includes commit messages, file paths, and code details — these are for YOUR understanding only.

CRITICAL RULES:
- MUST be under 280 characters total (count carefully)
- Write exactly ONE complete post — never end mid-sentence or mid-thought
- The post MUST be a complete, well-formed sentence or paragraph
- Sound authentic and human — not like a bot or marketing copy
- No excessive emojis (0-2 max)
- End with 1-2 relevant hashtags (always include #buildinpublic)
- Never start with "Just" for every post — vary your openings
- Do NOT include URLs — they will be added separately

ABSOLUTELY NEVER EXPOSE:
- File names or paths (e.g. "auth.ts", "middleware", "components/")
- Function or variable names (e.g. "handleWebhook", "fetchToken")
- Package/library names (e.g. "Stripe SDK", "Supabase", "Prisma") unless it's the main product
- Technical jargon that non-developers wouldn't understand
- Internal architecture details (e.g. "edge function", "webhook handler", "OAuth flow")
- Specific error messages or status codes

INSTEAD, TALK ABOUT:
- What the USER can now do (new features, fixed bugs, better experience)
- What you LEARNED or figured out during the build
- The PROGRESS or milestone (shipped, improved, launched)
- The FEELING of building (satisfaction, challenge, breakthrough)

TONE:
${toneInstructions[tone]}

CONTEXT HINT:
${changeTypeHints[changeType]}

EXAMPLES of good ${tone} posts:
${fewShotBlock}

Output ONLY the post text, nothing else.`

  const prompt = `Generate a build-in-public post for this ${input.sourceType}:\n${context}`

  let result = (await callGemini(system, prompt, { maxOutputTokens: 400, temperature: 0.7 })).trim()

  const TWITTER_LIMIT = 280
  if (result.length > TWITTER_LIMIT) {
    const truncated = result.slice(0, TWITTER_LIMIT - 1)
    const lastSpace = truncated.lastIndexOf(" ")
    result = `${lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated}…`
  }

  return result
}
