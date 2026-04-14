import type { AgentEvent, RecentPost } from './types'

// ─── Shared types for non-ranker prompts ──────────────────────────────────────

export interface RecapCommit {
  sha: string
  message: string
  author: string
  date: string
}

export interface RecapPr {
  number: number
  title: string
  merged_at: string
  additions: number
  deletions: number
}

export interface RecapRelease {
  tag_name: string
  name: string
  published_at: string
  body: string | null
}

export interface RepoRecapActivity {
  repoName: string
  commits: RecapCommit[]
  mergedPrs: RecapPr[]
  releases: RecapRelease[]
}

// ─── Ranker prompt ────────────────────────────────────────────────────────────

/**
 * Compact system prompt for the ranker. Replaces the old AGENT_INSTRUCTIONS
 * which drove a gatekeeper decision (skip/bundle_later/post).
 *
 * The ranker always produces an output — it labels each event as `high`
 * (user-visible, ship-worthy) or `low` (internal, trivial, or boring),
 * and picks a post angle. The UI shows high-signal drafts by default and
 * collapses low-signal under a disclosure.
 *
 * Intentionally short (~300 tokens) to minimise per-call token spend.
 */
export const RANKER_INSTRUCTIONS = `You rate developer commits for social-media worthiness and pick an angle.

OUTPUT:
- signal: "high" if user-visible feature, real bugfix, release, or milestone.
  "low" if internal refactor, tooling, test-only, dep bump, formatting, merge, or trivial.
- confidence: "high" / "medium" / "low" — your certainty in the rating.
- angle: one specific, opinionated hook for the post. NOT "ship update" or "new feature".
  Good: "removes a step users hated". "fixes the 3am pager bug". "dashboard loads 2x faster". "5 steps → 2".
  Great angles use contrasts (before→after), name a pain point, or highlight a surprising number.
  Must answer: why would a follower stop scrolling for this?
- reasoning: 1-2 sentences explaining the rating. Be concrete.

HIGH-SIGNAL EXAMPLES:
- Shipped dark mode toggle
- Fixed auth bug blocking signups
- Released v2.0 with new API
- Cut dashboard load 12s → 0.8s

LOW-SIGNAL EXAMPLES:
- Prettier formatting pass
- Bumped lodash 4.17.20 → 4.17.21
- Added more tests for existing module
- Renamed variables for clarity
- Internal refactor with no user impact

RULES:
- Prefer "low" when uncertain. Users can promote from low if they disagree.
- Avoid duplicating angles from the recent posts list.
- Never invent facts not in the event data.`

// ─── Tone helpers (unchanged from previous version) ───────────────────────────

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
    'Onboarding used to take 5 steps. Now it takes 2. Fewer clicks, faster start. #buildinpublic',
    'That auth bug blocking new signups? Squashed. Smooth sailing now. #shipping',
    'Most requested feature this month: CSV export. Just shipped it. #productupdate',
  ],
  professional: [
    'Cut onboarding from 5 steps to 2. Time-to-value dropped 60%. Better first impressions = better retention. #saas #shipping',
    'v2.1 is live. API response time cut in half, UI noticeably snappier. Performance is a feature. #devtools',
    'Role-based access control just went live. Built it because 3 enterprise teams asked independently. #saas',
  ],
  technical: [
    'Moved auth to session tokens with HTTP-only cookies. Same speed, way better security posture. #security #webdev',
    'Swapped to prepared statements + connection pooling. p95 latency: 120ms → 18ms. #postgres #performance',
    'Streaming SSR with Server Components landed. First paint went from 3.2s to 0.9s on the dashboard. #react #performance',
  ],
}

const changeTypeHints: Record<string, string> = {
  bugfix: 'This is a bug fix. Mention the problem solved and the relief of fixing it.',
  feature: 'This is a new feature. Highlight what users can now do.',
  refactor:
    'This is a refactor/cleanup. Emphasize the improvement to code quality or developer experience.',
  testing: 'This adds tests. Mention the value of reliability and confidence.',
  docs: 'This is a docs update. Highlight the value of good documentation.',
  performance: 'This is a performance improvement. Mention specific gains if available.',
  ui: 'This is a UI/design change. Mention the visual or UX improvement.',
  devops: 'This is a DevOps/CI change. Mention the deployment or infrastructure improvement.',
  general: 'Describe what was built, changed, or shipped.',
}

export function classifyChange(event: AgentEvent): string {
  const msg = (event.data.message ?? event.data.title ?? '').toLowerCase()
  const files = event.data.files ?? []

  if (msg.startsWith('fix') || msg.includes('bug') || msg.includes('hotfix')) return 'bugfix'
  if (
    msg.startsWith('feat') ||
    msg.includes('add') ||
    msg.includes('implement') ||
    msg.includes('new')
  )
    return 'feature'
  if (msg.startsWith('refactor') || msg.includes('clean') || msg.includes('reorganize'))
    return 'refactor'
  if (msg.includes('test') || msg.includes('spec')) return 'testing'
  if (msg.includes('doc') || msg.includes('readme')) return 'docs'
  if (msg.includes('perf') || msg.includes('optim') || msg.includes('speed')) return 'performance'
  if (msg.includes('style') || msg.includes('ui') || msg.includes('css') || msg.includes('design'))
    return 'ui'
  if (msg.includes('deploy') || msg.includes('ci') || msg.includes('pipeline')) return 'devops'

  const fileStr = files.join(' ').toLowerCase()
  if (fileStr.includes('test') || fileStr.includes('spec')) return 'testing'
  if (fileStr.includes('.md') || fileStr.includes('doc')) return 'docs'
  if (fileStr.includes('.css') || fileStr.includes('style') || fileStr.includes('component'))
    return 'ui'

  return 'general'
}

// ─── Ranker user prompt ───────────────────────────────────────────────────────

/**
 * Compact event summary for the ranker. Deliberately excludes raw diff patches
 * (those are reserved for the content-generation phase) — the ranker only
 * needs commit messages, file list, and scale to rate signal.
 */
export function buildRankerPrompt(event: AgentEvent, recentPosts: RecentPost[]): string {
  const parts: string[] = []

  parts.push(`Repo: ${event.repoName}`)
  parts.push(`Event type: ${event.sourceType}`)

  if (event.data.message) parts.push(`Commit message: "${event.data.message.slice(0, 400)}"`)
  if (event.data.title) parts.push(`Title: "${event.data.title.slice(0, 200)}"`)
  if (event.data.description) {
    parts.push(`Description: "${event.data.description.slice(0, 400)}"`)
  }

  if (event.data.additions !== undefined || event.data.deletions !== undefined) {
    parts.push(
      `Scale: +${event.data.additions ?? 0} / -${event.data.deletions ?? 0} across ${event.data.filesChanged ?? '?'} files`
    )
  } else if (event.data.filesChanged !== undefined) {
    parts.push(`Scale: ${event.data.filesChanged} files changed`)
  }

  if (event.data.commitMessages && event.data.commitMessages.length > 0) {
    const msgs = event.data.commitMessages.slice(0, 10).join('\n- ')
    parts.push(`Commits in this push:\n- ${msgs}`)
  }

  if (event.data.files && event.data.files.length > 0) {
    const fileList = event.data.files.slice(0, 20).join(', ')
    parts.push(`Files touched: ${fileList}`)
  }

  if (event.projectContext) {
    parts.push(`Project context: ${event.projectContext.slice(0, 500)}`)
  }

  if (recentPosts.length > 0) {
    const recent = recentPosts
      .slice(0, 5)
      .map((p) => `- [${p.source_type}] ${p.content.slice(0, 120)}`)
      .join('\n')
    parts.push(`Recent posts (avoid duplicating angles):\n${recent}`)
  }

  return parts.join('\n\n')
}

// ─── Content generation (unchanged — full diff reserved for this phase) ───────

export function buildContentSystemPrompt(tone: string, contentBudget: number = 280): string {
  const examples = toneExamples[tone] ?? toneExamples.casual
  const fewShotBlock = examples.map((ex, i) => `Example ${i + 1}: "${ex}"`).join('\n')

  return `You are a "build in public" content writer for developers on Twitter/X.

YOUR JOB: Read the technical context and write a post about what was SHIPPED. The context (commit messages, file paths, code details) is for YOUR understanding only.

HOOK-FIRST STRUCTURE (critical for engagement):
- First sentence MUST be the hook — the most interesting, specific, or surprising thing.
- Lead with a concrete result, number, or contrast when possible ("Dashboard load time: 12s → 0.8s", "5 steps → 2 steps").
- Before/after contrasts and specific numbers are the most shareable content. Use them whenever the context supports it.
- Never open with generic phrases like "Excited to announce" or "New update" — start with the substance.

VIRAL PATTERNS THAT WORK:
- Concrete numbers: "p95 latency dropped from 120ms to 18ms" > "improved performance"
- Problem → solution: Name the pain first, then the fix. "New signups were hitting an auth wall. Fixed."
- One-line story: Pack a mini narrative into a sentence. "Most requested feature this month? CSV export. Just shipped it."
- Tension + resolution: "That bug that's been haunting us for weeks? Gone."

CRITICAL RULES:
- MUST be under ${contentBudget} characters total
- The post MUST be a complete, self-contained statement. Every sentence must end properly. Never trail off with a comma, dash, or open quote.
- Sound authentic and human — like a developer sharing a win with peers, not a marketing team
- No excessive emojis (0-2 max)
- End with 1-2 relevant hashtags
- Vary openings — never start every post the same way
- Do NOT include URLs — they will be added separately
- NEVER fabricate events, numbers, metrics, or experiences that aren't in the provided context. If you don't have a specific number, don't make one up — describe the change qualitatively instead.

ABSOLUTELY NEVER EXPOSE:
- File names or paths
- Function or variable names
- Package/library names (unless it's the main product)
- Internal architecture details
- Specific error messages or status codes

INSTEAD, TALK ABOUT:
- What the USER can now do (new features, fixed bugs, better experience)
- The PROGRESS or milestone (shipped, improved, launched)
- Why this change matters for the product

TONE:
${toneInstructions[tone] ?? toneInstructions.casual}

EXAMPLES of good ${tone} posts:
${fewShotBlock}

Output ONLY the post text, nothing else.`
}

export function buildContentPrompt(event: AgentEvent, angle: string, highlights: string): string {
  const changeType = classifyChange(event)
  const parts: string[] = []

  if (event.sourceType === 'commit') {
    parts.push(`Commit in ${event.repoName}: "${event.data.message}"`)
  } else if (event.sourceType === 'pr') {
    const desc = event.data.description
      ? `\nPR description: ${event.data.description.slice(0, 1000)}`
      : ''
    parts.push(`PR merged in ${event.repoName}: "${event.data.title}"${desc}`)
  } else if (event.sourceType === 'release') {
    const desc = event.data.description
      ? `\nRelease notes: ${event.data.description.slice(0, 1000)}`
      : ''
    parts.push(`New release in ${event.repoName}: ${event.data.title}${desc}`)
  } else {
    parts.push(`New tag in ${event.repoName}: ${event.data.title}`)
  }

  if (event.data.additions !== undefined || event.data.deletions !== undefined) {
    parts.push(
      `Scale: +${event.data.additions ?? 0} -${event.data.deletions ?? 0} lines across ${event.data.filesChanged ?? '?'} files`
    )
  }

  if (event.data.commitMessages && event.data.commitMessages.length > 0) {
    const msgs = event.data.commitMessages.slice(0, 15).join('\n- ')
    parts.push(`Commit history:\n- ${msgs}`)
  }

  if (event.data.diffs && event.data.diffs.length > 0) {
    const diffSections = event.data.diffs
      .filter((d) => d.patch)
      .map((d) => `--- ${d.filename} (${d.status}, +${d.additions} -${d.deletions})\n${d.patch}`)
    if (diffSections.length > 0) {
      parts.push(`Code changes:\n${diffSections.join('\n\n')}`)
    }
  } else if (event.data.files && event.data.files.length > 0) {
    const fileList = event.data.files.slice(0, 20).join('\n- ')
    parts.push(`Files touched:\n- ${fileList}`)
  }

  if (event.projectContext) {
    parts.push(
      `Project background (for your understanding — do NOT expose raw details):\n${event.projectContext.slice(0, 1500)}`
    )
  }

  parts.push(`\nCONTEXT HINT: ${changeTypeHints[changeType]}`)
  parts.push(`\nANGLE: ${angle}`)
  parts.push(`KEY HIGHLIGHTS: ${highlights}`)

  return `Generate a shipping update post for this ${event.sourceType}:\n\n${parts.join('\n\n')}`
}

// ─── Intro post (new repo onboarding) ─────────────────────────────────────────

export function buildIntroSystemPrompt(tone: string, contentBudget: number = 280): string {
  const examples = (toneExamples[tone] ?? toneExamples.casual)
    .map((ex, i) => `Example ${i + 1}: "${ex}"`)
    .join('\n')

  return `You are a content writer helping developers share what they're building on Twitter/X.

YOUR JOB: Write an introductory post about a project. This is NOT a shipping update — it's a "here's what I'm building" announcement.

CRITICAL RULES:
- MUST be under ${contentBudget} characters total
- The post MUST be a complete, self-contained statement. Every sentence must end properly. Never trail off with a comma, dash, or open quote.
- Sound authentic — like a developer genuinely excited about their project
- No excessive emojis (0-2 max)
- End with 1-2 relevant hashtags
- Do NOT include URLs
- Do NOT expose internal technical details (file names, function names, architecture)
- Focus on: what the project DOES, who it's FOR, why it's interesting

TONE:
${toneInstructions[tone] ?? toneInstructions.casual}

EXAMPLES of good ${tone} posts:
${examples}

Output ONLY the post text, nothing else.`
}

export function buildIntroPrompt(repoName: string, projectContext: string): string {
  return `Write an introductory post for this project:\n\nProject: ${repoName}\n\nContext:\n${projectContext.slice(0, 2000)}`
}

// ─── XHS-style variant (format inspired by 小红书, pick lang per call) ─────────

export type XhsLang = 'en' | 'zh'

const xhsChangeTypeHintsEn: Record<string, string> = {
  bugfix: 'Bug fix — highlight what was broken and the relief of fixing it.',
  feature: 'New feature — spotlight what users can now do.',
  refactor: 'Refactor — emphasize the improvement to code quality or developer experience.',
  testing: 'Testing update — emphasize reliability and confidence.',
  docs: 'Docs update — emphasize the value of good documentation.',
  performance: 'Performance improvement — highlight concrete gains.',
  ui: 'UI / design change — describe the visual or UX improvement.',
  devops: 'DevOps / CI change — emphasize deployment or infrastructure improvement.',
  general: 'Describe what was built, changed, or shipped.',
}

const xhsChangeTypeHintsZh: Record<string, string> = {
  bugfix: '这是一个Bug修复，强调解决了什么问题以及修复过程中的心得。',
  feature: '这是一个新功能，突出用户现在可以做什么。',
  refactor: '这是代码重构，强调代码质量和开发体验的提升。',
  testing: '这是测试相关的更新，强调代码质量和可靠性。',
  docs: '这是文档更新，强调好文档的价值。',
  performance: '这是性能优化，突出具体的性能提升数据。',
  ui: '这是UI/设计变更，描述视觉或用户体验的改善。',
  devops: '这是DevOps/CI变更，强调部署或基础设施的改进。',
  general: '描述构建、修改或发布了什么。',
}

export function buildXhsSystemPrompt(event: AgentEvent, lang: XhsLang = 'en'): string {
  const changeType = classifyChange(event)

  if (lang === 'zh') {
    return `你是一个技术内容作者，帮开发团队把代码变更转化为小红书风格的产品动态。

核心原则：
- 严格基于提供的代码变更信息写作，绝对不要编造任何没有发生的事情
- 不要虚构故事、翻车经历、踩坑过程或任何不在上下文中的细节
- 如果上下文信息有限，就写简短的更新，不要用虚构内容来凑字数

格式规则：
- 字数控制在 200-500 字符
- 每句话必须写完整，不能以逗号、破折号或引号结尾。宁可少写一个细节也不要断句。
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
${xhsChangeTypeHintsZh[changeType]}

输出纯文本文案。`
  }

  return `You are a technical content writer turning code changes into XHS-style product updates.

CORE PRINCIPLE:
- Write strictly from the provided context. Do NOT invent events, outages, or war stories.
- If the context is thin, keep the post short. Never pad with fabricated detail.

FORMAT RULES:
- Total length: 200–500 characters.
- Every sentence must end properly. Never trail off with a comma, dash, or open quote. Cut a detail before cutting a sentence.
- First line is the title — start with an emoji, keep it short and punchy.
- Body is segmented into short paragraphs, each led by an emoji acting as a mini-heading or bullet.
- Tone: concise and professional, like a product release note.
- Use emojis (3–6 total), never pile them up.
- End with 2–4 hashtags using the format #topic#, for example #buildinpublic# #devtools# #shipping# #productupdate#.
- Do NOT include URLs.
- Do NOT use Markdown.
- Output only the post text, nothing else.

CONTEXT HINT:
${xhsChangeTypeHintsEn[changeType]}

Output plain text only.`
}

export function buildXhsPrompt(event: AgentEvent, lang: XhsLang = 'en'): string {
  let context: string
  if (event.sourceType === 'commit') {
    context = `Commit in ${event.repoName}: "${event.data.message}"`
  } else if (event.sourceType === 'pr') {
    const desc = event.data.description
      ? `\nPR description: ${event.data.description.slice(0, 1000)}`
      : ''
    context = `PR merged in ${event.repoName}: "${event.data.title}"${desc}`
  } else if (event.sourceType === 'release') {
    const desc = event.data.description
      ? `\nRelease notes: ${event.data.description.slice(0, 1000)}`
      : ''
    context = `New release in ${event.repoName}: ${event.data.title}${desc}`
  } else {
    context = `New tag in ${event.repoName}: ${event.data.title}`
  }

  if (lang === 'zh') {
    const projectBlock = event.projectContext
      ? `\n\n项目背景（仅供理解，不要直接暴露原始细节）：\n${event.projectContext.slice(0, 1500)}`
      : ''
    return `为以下开发动态生成一篇小红书文案：\n${context}${projectBlock}`
  }

  const projectBlock = event.projectContext
    ? `\n\nProject background (for your understanding — do NOT expose raw details):\n${event.projectContext.slice(0, 1500)}`
    : ''
  return `Write an XHS-style English post for this development update:\n${context}${projectBlock}`
}

// ─── LinkedIn-optimised variant ──────────────────────────────────────────────

const linkedinChangeTypeHints: Record<string, string> = {
  bugfix: 'Bug fix — frame it as a problem you hunted down and the lesson learned.',
  feature: 'New feature — spotlight what users can now do and why it matters.',
  refactor: 'Refactor — frame as investing in long-term quality or developer experience.',
  testing: 'Testing update — frame as caring about reliability and craft.',
  docs: 'Docs update — frame as reducing friction for users or contributors.',
  performance: 'Performance improvement — lead with the before/after numbers.',
  ui: 'UI / design change — describe the user experience improvement.',
  devops: 'DevOps / CI change — frame as shipping faster or more reliably.',
  general: 'Describe what was built, changed, or shipped and why it matters.',
}

export function buildLinkedInSystemPrompt(event: AgentEvent): string {
  const changeType = classifyChange(event)

  return `You are a "build in public" content writer for developers on LinkedIn.

YOUR JOB: Turn a code change into a LinkedIn post that earns engagement through substance, not gimmicks.

LINKEDIN-SPECIFIC FORMAT (critical for the algorithm):
- FIRST LINE IS EVERYTHING. It appears above the "see more" fold. Make it a punchy hook — a surprising number, a question, a bold statement, or a before/after contrast. This single line determines whether anyone reads the rest.
- Use short paragraphs (1-2 sentences each) separated by blank lines. Mobile readers scroll — give them whitespace.
- Total length: 800–2000 characters. LinkedIn rewards dwell time, so longer thoughtful posts outperform one-liners.
- Structure: Hook → Context (what you built/fixed) → Insight (lesson, number, or "why it matters") → Soft CTA or forward-looking statement.
- End with 3-5 hashtags on a separate line.

WHAT WORKS ON LINKEDIN (2026 algorithm):
- Concrete before/after numbers: "Dashboard load time: 12s → 0.8s" gets bookmarked and shared.
- Lessons and mistakes: "I spent a week over-engineering X. Here's what I should have done." These are the most commented-on posts.
- Problem → solution narrative: Name the pain, describe the hunt, reveal the fix.
- Niche expertise signals: Show depth, not breadth. Specific > generic.
- Questions that invite real answers (NOT engagement bait like "Agree?").

WHAT KILLS REACH ON LINKEDIN:
- Engagement bait ("Like if you agree", "Comment YES") — the algorithm detects and throttles this.
- Generic opener phrases: "Excited to share", "Thrilled to announce", "I'm happy to say" — skip to the substance.
- External links in the post body — massive reach penalty. Do NOT include URLs.
- Excessive emojis or bullet-point walls — keep emojis to 0-3, use sparingly.

AUTHENTICITY RULES:
- Sound like a developer sharing a real experience, not a LinkedIn influencer.
- NEVER fabricate events, metrics, bugs, outages, or experiences not in the provided context.
- If you don't have specific numbers, describe the change qualitatively. Don't invent data.
- Do NOT expose file names, function names, package names, or internal architecture details.
- Talk about what USERS can now do, what PROBLEM was solved, or what you LEARNED.

CONTEXT HINT:
${linkedinChangeTypeHints[changeType]}

Output ONLY the post text, nothing else.`
}

export function buildLinkedInPrompt(event: AgentEvent, angle: string, highlights: string): string {
  const parts: string[] = []

  if (event.sourceType === 'commit') {
    parts.push(`Commit in ${event.repoName}: "${event.data.message}"`)
  } else if (event.sourceType === 'pr') {
    const desc = event.data.description
      ? `\nPR description: ${event.data.description.slice(0, 1000)}`
      : ''
    parts.push(`PR merged in ${event.repoName}: "${event.data.title}"${desc}`)
  } else if (event.sourceType === 'release') {
    const desc = event.data.description
      ? `\nRelease notes: ${event.data.description.slice(0, 1000)}`
      : ''
    parts.push(`New release in ${event.repoName}: ${event.data.title}${desc}`)
  } else {
    parts.push(`New tag in ${event.repoName}: ${event.data.title}`)
  }

  if (event.data.additions !== undefined || event.data.deletions !== undefined) {
    parts.push(
      `Scale: +${event.data.additions ?? 0} -${event.data.deletions ?? 0} lines across ${event.data.filesChanged ?? '?'} files`
    )
  }

  if (event.data.commitMessages && event.data.commitMessages.length > 0) {
    const msgs = event.data.commitMessages.slice(0, 15).join('\n- ')
    parts.push(`Commit history:\n- ${msgs}`)
  }

  if (event.data.diffs && event.data.diffs.length > 0) {
    const diffSections = event.data.diffs
      .filter((d) => d.patch)
      .map((d) => `--- ${d.filename} (${d.status}, +${d.additions} -${d.deletions})\n${d.patch}`)
    if (diffSections.length > 0) {
      parts.push(`Code changes:\n${diffSections.join('\n\n')}`)
    }
  } else if (event.data.files && event.data.files.length > 0) {
    const fileList = event.data.files.slice(0, 20).join('\n- ')
    parts.push(`Files touched:\n- ${fileList}`)
  }

  if (event.projectContext) {
    parts.push(
      `Project background (for your understanding — do NOT expose raw details):\n${event.projectContext.slice(0, 1500)}`
    )
  }

  parts.push(`\nANGLE: ${angle}`)
  parts.push(`KEY HIGHLIGHTS: ${highlights}`)

  return `Generate a LinkedIn "build in public" post for this ${event.sourceType}:\n\n${parts.join('\n\n')}`
}

// ─── Recap (weekly / branch) ──────────────────────────────────────────────────

export function buildRecapSystemPrompt(
  tone: string,
  charLimit: number,
  mode: 'week' | 'branch'
): string {
  const modeFraming =
    mode === 'branch'
      ? 'You are writing a social media post about progress on a specific feature branch. Focus on what was built, the progression of work, and the end result.'
      : 'You are writing a weekly recap for a developer\'s "build in public" social media. Weave all activity into a coherent narrative about what was shipped this week.'

  return `${modeFraming}

TONE:
${toneInstructions[tone] ?? toneInstructions.casual}

CRITICAL RULES:
- MUST be under ${charLimit} characters
- The post MUST be a complete, self-contained statement. Every sentence must end properly. Never trail off with a comma, dash, or open quote. If you're running long, cut a detail — don't cut a sentence in half.
- ${mode === 'branch' ? 'Focus on the feature story — what problem it solves, what changed' : 'Highlight the overall theme or direction of the week'}
- Mention 2-4 key things shipped or worked on
- End with 1-2 relevant hashtags
- Sound like a real person, not a bot
- Do NOT expose file names, function names, or internal architecture
- Talk about what the USER can now do or what PROGRESS was made
- If there are merged PRs, prefer talking about those over individual commits
- ${mode === 'branch' ? 'This is about ONE feature branch — keep it focused' : 'This is a WEEKLY SUMMARY, not individual updates'}

Output ONLY the post text, nothing else.`
}

const MAX_COMMITS_PER_REPO = 15

export function buildRecapPrompt(
  repoData: RepoRecapActivity[],
  recentPosts: RecentPost[],
  mode: 'week' | 'branch',
  projectContexts?: Map<string, string>
): string {
  const parts: string[] = []

  const reposWithData = repoData.filter(
    (r) => r.commits.length > 0 || r.mergedPrs.length > 0 || r.releases.length > 0
  )

  if (reposWithData.length > 0) {
    const header = mode === 'branch' ? 'BRANCH ACTIVITY:' : 'GITHUB ACTIVITY THIS WEEK:'
    const repoSections = reposWithData.map((repo) => {
      const lines: string[] = [`## ${repo.repoName}`]

      const ctx = projectContexts?.get(repo.repoName)
      if (ctx) lines.push(ctx)

      const filteredCommits = repo.commits
        .filter((c) => !c.message.startsWith('Merge '))
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
          lines.push(`- PR #${pr.number}: ${pr.title} (+${pr.additions} -${pr.deletions})`)
        }
      }

      if (repo.releases.length > 0) {
        lines.push(`\nReleases (${repo.releases.length}):`)
        for (const r of repo.releases) {
          const desc = r.body ? ` — ${r.body.slice(0, 200)}` : ''
          lines.push(`- ${r.tag_name}: ${r.name}${desc}`)
        }
      }

      return lines.join('\n')
    })

    parts.push(`${header}\n\n${repoSections.join('\n\n')}`)
  }

  if (recentPosts.length > 0) {
    const postLines = recentPosts.map((p) => `- "${p.content}"`)
    parts.push(`ALREADY SHARED RECENTLY:\n${postLines.join('\n')}`)
  }

  const instruction =
    mode === 'branch'
      ? 'Generate ONE post summarizing what was built on this branch.'
      : 'Generate ONE weekly recap post that covers the full week.'
  parts.push(instruction)

  return parts.join('\n\n')
}
