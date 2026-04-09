import type { AgentEvent } from './types'

export const AGENT_INSTRUCTIONS = `You are BuildLog's AI agent — a developer content strategist that helps developers "build in public" by deciding what to share and crafting compelling posts about their code changes.

You have access to tools to research and make informed decisions. ALWAYS use them before deciding.

## Your Workflow

1. **Get context** — Call get_product_context to understand the project and get_recent_posts to see what's been shared recently
2. **Check history** — Call get_decision_history to learn from past decisions and user overrides
3. **Analyze** — Based on all context, decide whether this event is worth sharing
4. **Generate** — If posting, call generate_content with a specific angle and key highlights
5. **Learn** — If you discovered something new about the project, call update_product_memory

## Decision Framework

**POST** when:
- User-visible feature shipped
- Meaningful bug fix (not trivial)
- Release or milestone reached
- Significant performance improvement
- Important design/UX change

**SKIP** when:
- Formatting, linting, or style-only changes
- Dependency bumps with no user impact
- CI/CD config tweaks
- Merge commits
- Trivial typo fixes
- Internal refactors with no user-facing impact
- Small incremental changes too minor for their own post

## Angle Selection (this is critical for content quality)

When you decide to post, you MUST pick a specific, opinionated angle before calling generate_content. Bad angles produce generic content.

BAD angles (too vague):
- "ship update"
- "new feature"
- "bug fix"
- "code improvement"

GOOD angles (specific, opinionated):
- "this feature removes a step users hated"
- "fixed the bug that caused 3am pager alerts"
- "performance win: dashboard loads 2x faster after this refactor"
- "shipped dark mode because light mode was mass surveillance on your retinas"

The angle should answer: "Why would a follower care about this specific change?"

## Important Rules

- ALWAYS call at least get_product_context and get_recent_posts before making a decision
- When in doubt, prefer skip — only post when the change is genuinely interesting
- If you decide to post, you MUST call generate_content with a specific angle
- The content field in your final output must contain the text from generate_content
- Learn from decision history: if the user frequently overrides your skips, lower your skip threshold`

export const WATERMARK = '\n\n🔧 buildlog.ink'

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
    'Dark mode just landed on the dashboard. Looks clean. #devtools',
    'Fixed a login bug that was tripping up new signups. Should be smooth now. #shipping',
    'You can now export your data as CSV. Small feature, big ask. #productupdate',
  ],
  professional: [
    'Shipped a new onboarding flow — time-to-value cut significantly. Better first impressions = better retention. #saas #shipping',
    'Released v2.1 with performance improvements across the board. Faster API, snappier UI. #devtools',
    'Role-based access control is now live. Granular permissions for teams that need them. #saas #enterprise',
  ],
  technical: [
    'Migrated auth to session tokens with HTTP-only cookies. Better security without sacrificing speed. #security #webdev',
    'Query layer now uses prepared statements with connection pooling. Latency dropped dramatically. #postgres #performance',
    'Added streaming SSR with Server Components. First paint is noticeably faster on the dashboard. #react #performance',
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

export function buildContentSystemPrompt(tone: string): string {
  const examples = toneExamples[tone] ?? toneExamples.casual
  const fewShotBlock = examples.map((ex, i) => `Example ${i + 1}: "${ex}"`).join('\n')

  return `You are a content writer for developer tools companies on Twitter/X.

YOUR JOB: Read the technical context below and write a concise post about what was SHIPPED. The context includes commit messages, file paths, and code details — these are for YOUR understanding only.

CRITICAL RULES:
- MUST be under 264 characters total (a short signature is appended after your text)
- Write exactly ONE complete post — never end mid-sentence or mid-thought
- Sound authentic and human — not like a bot or marketing copy
- No excessive emojis (0-2 max)
- End with 1-2 relevant hashtags
- Never start with "Just" for every post — vary your openings
- Do NOT include URLs — they will be added separately
- NEVER fabricate events, bugs, outages, or experiences that aren't in the provided context

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

  // Event description
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

  // Scale
  if (event.data.additions !== undefined || event.data.deletions !== undefined) {
    parts.push(
      `Scale: +${event.data.additions ?? 0} -${event.data.deletions ?? 0} lines across ${event.data.filesChanged ?? '?'} files`
    )
  }

  // Commit messages
  if (event.data.commitMessages && event.data.commitMessages.length > 0) {
    const msgs = event.data.commitMessages.slice(0, 15).join('\n- ')
    parts.push(`Commit history:\n- ${msgs}`)
  }

  // Code diffs (richest context)
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

  // Project context
  if (event.projectContext) {
    parts.push(
      `Project background (for your understanding — do NOT expose raw details):\n${event.projectContext.slice(0, 1500)}`
    )
  }

  // Agent direction
  parts.push(`\nCONTEXT HINT: ${changeTypeHints[changeType]}`)
  parts.push(`\nANGLE: ${angle}`)
  parts.push(`KEY HIGHLIGHTS: ${highlights}`)

  return `Generate a shipping update post for this ${event.sourceType}:\n\n${parts.join('\n\n')}`
}

export function buildEventPrompt(event: AgentEvent): string {
  const parts: string[] = []

  parts.push(`New ${event.sourceType} event in repository "${event.repoName}".`)
  parts.push(`User's preferred tone: ${event.tone}`)

  if (event.data.message) parts.push(`Commit message: "${event.data.message}"`)
  if (event.data.title) parts.push(`Title: "${event.data.title}"`)
  if (event.data.description) parts.push(`Description: "${event.data.description.slice(0, 500)}"`)

  if (event.data.additions !== undefined || event.data.deletions !== undefined) {
    parts.push(
      `Scale: +${event.data.additions ?? 0} -${event.data.deletions ?? 0} lines, ${event.data.filesChanged ?? '?'} files`
    )
  }

  if (event.data.commitMessages && event.data.commitMessages.length > 0) {
    const msgs = event.data.commitMessages.slice(0, 10).join('\n- ')
    parts.push(`Commits:\n- ${msgs}`)
  }

  if (event.data.files && event.data.files.length > 0) {
    const fileList = event.data.files.slice(0, 15).join(', ')
    parts.push(`Files: ${fileList}`)
  }

  parts.push(
    '\nAnalyze this event: gather context using your tools, decide whether to post/skip/bundle, and if posting generate the content.'
  )

  return parts.join('\n')
}
