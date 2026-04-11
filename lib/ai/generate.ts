import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import {
  buildGenerationSystemPrompt,
  buildIntroSystemPrompt,
  buildXhsSystemPrompt,
} from './prompts'
import type { GenerateInput } from './schemas'

// ---------------------------------------------------------------------------
// AI SDK-backed content generation
// ---------------------------------------------------------------------------

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY,
})

const WATERMARKS = {
  default: '',
  xhs: '',
} as const

/**
 * Generate post content using AI SDK.
 * Handles all variants: standard post, intro post, and XHS post.
 */
export async function generate(input: GenerateInput): Promise<string> {
  if (input.variant === 'xhs') {
    return generateXhs(input)
  }
  if (input.sourceType === 'intro') {
    return generateIntro(input)
  }
  return generatePost(input)
}

async function generatePost(input: GenerateInput): Promise<string> {
  const tone = input.tone ?? 'casual'
  const charLimit = input.contentBudget ?? 280
  const changeType = classifyChange(input)
  const context = buildEventContext(input)
  const systemPrompt = buildGenerationSystemPrompt(tone, changeType, charLimit)

  const projectBlock = input.projectContext
    ? `\n\nProject background (for your understanding — do NOT expose raw details):\n${input.projectContext.slice(0, 1500)}`
    : ''

  const productBlock = buildProductContextBlock(input)
  const angleBlock = input.angle ? `\n\nSuggested angle: ${input.angle}` : ''

  const prompt = `Generate a shipping update post for this ${input.sourceType}:\n${context}${projectBlock}${productBlock}${angleBlock}`

  let result = await callGenerate(systemPrompt, prompt, { temperature: 0.7 })

  // Retry if over char limit
  if (result.length > charLimit) {
    result = await callGenerate(
      systemPrompt,
      `${prompt}\n\nIMPORTANT: Your previous attempt was ${result.length} characters. Rewrite it to fit under ${charLimit} characters while keeping it complete and engaging.`,
      { temperature: 0.5 }
    )

    if (result.length > charLimit) {
      const truncated = truncateToSentence(result.slice(0, charLimit))
      result = truncated.length > 0 ? truncated : `${result.slice(0, charLimit - 1)}\u2026`
    }
  }

  // Ensure complete sentence
  if (!isComplete(result)) {
    result = truncateToSentence(result)
  }

  return result + WATERMARKS.default
}

async function generateIntro(input: GenerateInput): Promise<string> {
  const tone = input.tone ?? 'casual'
  const charLimit = input.contentBudget ?? 280
  const systemPrompt = buildIntroSystemPrompt(tone, charLimit)
  const prompt = `Write an introductory post for this project:\n\nProject: ${input.repoName}\n\nContext:\n${(input.projectContext ?? '').slice(0, 2000)}`

  let result = await callGenerate(systemPrompt, prompt, { temperature: 0.8 })

  // Retry if over char limit
  if (result.length > charLimit) {
    result = await callGenerate(
      systemPrompt,
      `${prompt}\n\nIMPORTANT: Your previous attempt was ${result.length} characters. Rewrite under ${charLimit} characters. End with a complete sentence.`,
      { temperature: 0.5 }
    )

    if (result.length > charLimit) {
      const truncated = truncateToSentence(result.slice(0, charLimit))
      result = truncated.length > 0 ? truncated : `${result.slice(0, charLimit - 1)}\u2026`
    }
  }

  if (!isComplete(result)) {
    result = truncateToSentence(result)
  }

  return result + WATERMARKS.default
}

async function generateXhs(input: GenerateInput): Promise<string> {
  const changeType = classifyChange(input)
  const context = buildEventContext(input)
  const systemPrompt = buildXhsSystemPrompt(changeType)

  const projectBlock = input.projectContext
    ? `\n\n项目背景（仅供理解，不要直接暴露原始细节）：\n${input.projectContext.slice(0, 1500)}`
    : ''

  const prompt = `为以下开发动态生成一篇小红书文案：\n${context}${projectBlock}`

  const result = await callGenerate(systemPrompt, prompt, {
    temperature: 0.85,
    maxOutputTokens: 600,
  })

  return result + WATERMARKS.xhs
}

// ---------------------------------------------------------------------------
// Helpers (ported from supabase/functions/_shared/ai.ts)
// ---------------------------------------------------------------------------

async function callGenerate(
  system: string,
  prompt: string,
  opts?: { temperature?: number; maxOutputTokens?: number }
): Promise<string> {
  const { text } = await generateText({
    model: google('gemini-2.5-flash'),
    system,
    prompt,
    temperature: opts?.temperature ?? 0.7,
    maxOutputTokens: opts?.maxOutputTokens ?? 800,
  })

  return text.trim()
}

function classifyChange(input: GenerateInput): string {
  const msg = (input.data.message ?? input.data.title ?? '').toLowerCase()
  const files = input.data.files ?? []

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

function buildEventContext(input: GenerateInput): string {
  const parts: string[] = []

  // Event-specific header
  if (input.sourceType === 'commit') {
    parts.push(`Commit in ${input.repoName}: "${input.data.message}"`)
  } else if (input.sourceType === 'pr') {
    parts.push(`PR merged in ${input.repoName}: "${input.data.title}"`)
    if (input.data.description)
      parts.push(`PR description: ${input.data.description.slice(0, 1000)}`)
  } else if (input.sourceType === 'release') {
    parts.push(`New release in ${input.repoName}: ${input.data.title}`)
    if (input.data.description)
      parts.push(`Release notes: ${input.data.description.slice(0, 1000)}`)
  } else {
    parts.push(`New tag in ${input.repoName}: ${input.data.title}`)
  }

  // Scale
  if (input.data.additions !== undefined || input.data.deletions !== undefined) {
    const adds = input.data.additions ?? 0
    const dels = input.data.deletions ?? 0
    parts.push(`Scale: +${adds} -${dels} lines across ${input.data.filesChanged ?? '?'} files`)
  }

  // Commit messages
  if (input.data.commitMessages?.length) {
    const msgs = input.data.commitMessages.slice(0, 15).join('\n- ')
    parts.push(`Commit history:\n- ${msgs}`)
  }

  // Code diffs
  if (input.data.diffs?.length) {
    const diffSections = input.data.diffs
      .filter((d) => d.patch)
      .map((d) => `--- ${d.filename} (${d.status}, +${d.additions} -${d.deletions})\n${d.patch}`)
    if (diffSections.length > 0) {
      parts.push(`Code changes:\n${diffSections.join('\n\n')}`)
    }
  } else if (input.data.files?.length) {
    const fileList = input.data.files.slice(0, 20).join('\n- ')
    parts.push(
      `Files touched:\n- ${fileList}${input.data.files.length > 20 ? `\n  (+${input.data.files.length - 20} more)` : ''}`
    )
  }

  return parts.join('\n\n')
}

function buildProductContextBlock(input: GenerateInput): string {
  if (!input.productContext) return ''

  const ctx = input.productContext
  const parts: string[] = []
  if (ctx.productSummary) parts.push(`What this product does: ${ctx.productSummary}`)
  if (ctx.targetAudience) parts.push(`Target audience: ${ctx.targetAudience}`)
  if (ctx.currentNarrative) parts.push(`Current story arc: ${ctx.currentNarrative}`)
  if (ctx.topicsToEmphasize?.length) parts.push(`Emphasize: ${ctx.topicsToEmphasize.join(', ')}`)
  if (ctx.topicsToAvoid?.length) parts.push(`Avoid mentioning: ${ctx.topicsToAvoid.join(', ')}`)

  if (parts.length === 0) return ''
  return `\n\nProduct context (use to inform tone and angle, do NOT expose directly):\n${parts.join('\n')}`
}

function isComplete(text: string): boolean {
  return /[.!?](\s*#\S+)*\s*$/.test(text) || /^#\S+\s*$/.test(text.split('\n').pop() ?? '')
}

function truncateToSentence(text: string): string {
  const match = text.match(/^([\s\S]*[.!?])(\s*#\S+)*/)
  return match ? match[0].trim() : text
}
