import { generateText, wrapLanguageModel } from 'ai'
import { guardrailMiddleware, timeoutSignal } from '@/lib/ai/middleware'
import { getGoogleProvider, type LanguageModel } from '@/lib/ai/provider'
import { getContentLimit } from '@/lib/platforms'
import {
  buildContentPrompt,
  buildContentSystemPrompt,
  buildIntroPrompt,
  buildIntroSystemPrompt,
  buildLinkedInPrompt,
  buildLinkedInSystemPrompt,
  buildRecapPrompt,
  buildRecapSystemPrompt,
  buildXhsPrompt,
  buildXhsSystemPrompt,
  type RepoRecapActivity,
  type XhsLang,
} from './prompts'
import type { AgentEvent, RecentPost } from './types'

/**
 * Central generation module. All content-generation calls (ranker-driven,
 * regenerate, xhs, intro, recap) flow through here so prompts, models, and
 * safety middleware stay in one place.
 */

const CONTENT_MODEL = process.env.CONTENT_MODEL ?? 'gemini-3-flash-preview'

function defaultModel(): LanguageModel {
  const google = getGoogleProvider()
  return wrapLanguageModel({ model: google(CONTENT_MODEL), middleware: guardrailMiddleware })
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function truncateAtSentence(text: string, maxLen: number): string {
  const slice = text.slice(0, maxLen)
  const match = slice.match(/^([\s\S]*[.!?])(\s*#\S+)*/)
  return match ? match[0].trim() : `${text.slice(0, maxLen - 1)}\u2026`
}

function isComplete(text: string): boolean {
  return /[.!?](\s*#\S+)*\s*$/.test(text) || /^#\S+\s*$/.test(text.split('\n').pop() ?? '')
}

// ─── Main generators ──────────────────────────────────────────────────────────

/**
 * Generate a post with the supplied angle + highlights.
 * Used by the ranker pipeline and by manual regenerate requests.
 *
 * `platform` controls the character budget via getContentLimit(). Defaults to
 * 'twitter' so the ranker pipeline and legacy callers stay unchanged. Pass
 * 'bluesky' (300 chars) when generating a Bluesky-specific variant — the
 * short-form prompt works for both since tone and structure are near-identical.
 */
export async function generateContent(
  event: AgentEvent,
  angle: string,
  highlights: string,
  model: LanguageModel = defaultModel(),
  platform: 'twitter' | 'bluesky' = 'twitter'
): Promise<string | null> {
  const contentBudget = getContentLimit(platform, event.xPremium)
  const systemPrompt = buildContentSystemPrompt(event.tone, contentBudget)
  const userPrompt = buildContentPrompt(event, angle, highlights)

  /* eslint-disable vercel-ai-security/require-validated-prompt, vercel-ai-security/no-dynamic-system-prompt -- prompts constructed from trusted server-side data */
  const { text } = await generateText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    maxOutputTokens: event.xPremium ? 2000 : 800,
    temperature: 0.7,
    abortSignal: timeoutSignal(),
  })

  let content = text.trim()
  if (content.length < 10) return null

  // Retry if over budget OR incomplete (missing sentence-ending punctuation)
  if (content.length > contentBudget || !isComplete(content)) {
    const reason =
      content.length > contentBudget
        ? `Your previous attempt was ${content.length} characters. Rewrite under ${contentBudget} characters while keeping it complete and engaging.`
        : `Your previous attempt ended mid-sentence. Rewrite it as a complete, self-contained post that ends with proper punctuation and 1-2 hashtags.`
    const retry = await generateText({
      model,
      system: systemPrompt,
      prompt: `${userPrompt}\n\nIMPORTANT: ${reason}`,
      maxOutputTokens: event.xPremium ? 2000 : 800,
      temperature: 0.5,
      abortSignal: timeoutSignal(),
    })
    const retryText = retry.text.trim()
    content =
      retryText.length <= contentBudget && isComplete(retryText)
        ? retryText
        : truncateAtSentence(retryText.length > content.length ? retryText : content, contentBudget)
  }
  /* eslint-enable vercel-ai-security/require-validated-prompt, vercel-ai-security/no-dynamic-system-prompt */

  return content
}

/**
 * Generate an intro post for a newly connected repo. Separate from the
 * shipping-update generator because the framing is "here's what I'm building"
 * rather than "here's what I just shipped".
 */
export async function generateIntroPost(
  repoName: string,
  projectContext: string,
  tone: 'casual' | 'professional' | 'technical' = 'casual',
  contentBudget: number = 280,
  model: LanguageModel = defaultModel()
): Promise<string> {
  const system = buildIntroSystemPrompt(tone, contentBudget)
  const prompt = buildIntroPrompt(repoName, projectContext)

  /* eslint-disable vercel-ai-security/require-validated-prompt, vercel-ai-security/no-dynamic-system-prompt */
  const { text } = await generateText({
    model,
    system,
    prompt,
    maxOutputTokens: 800,
    temperature: 0.8,
    abortSignal: timeoutSignal(),
  })
  let result = text.trim()

  // Retry once if over budget or mid-sentence
  if (result.length > contentBudget || !isComplete(result)) {
    const retry = await generateText({
      model,
      system,
      prompt: `${prompt}\n\nIMPORTANT: Rewrite under ${contentBudget} characters and end with a complete sentence.`,
      maxOutputTokens: 800,
      temperature: 0.5,
      abortSignal: timeoutSignal(),
    })
    const retryText = retry.text.trim()
    if (retryText.length <= contentBudget && isComplete(retryText)) {
      result = retryText
    } else {
      result = truncateAtSentence(
        retryText.length > result.length ? retryText : result,
        contentBudget
      )
    }
  }
  /* eslint-enable vercel-ai-security/require-validated-prompt, vercel-ai-security/no-dynamic-system-prompt */

  return result
}

/**
 * Generate an XHS-style variant of an event. Emoji-heavy format (200-500 chars
 * of title + segmented body + hashtags). Caller picks the output language
 * (`en` for English audiences, `zh` for 小红书).
 */
export async function generateXhsPost(
  event: AgentEvent,
  lang: XhsLang = 'en',
  model: LanguageModel = defaultModel()
): Promise<string> {
  const system = buildXhsSystemPrompt(event, lang)
  const prompt = buildXhsPrompt(event, lang)

  /* eslint-disable vercel-ai-security/require-validated-prompt, vercel-ai-security/no-dynamic-system-prompt */
  const { text } = await generateText({
    model,
    system,
    prompt,
    maxOutputTokens: 600,
    temperature: 0.85,
    abortSignal: timeoutSignal(),
  })
  let result = text.trim()

  // Very short output is a signal the first attempt was cut off — retry once.
  if (result.length < 50) {
    const retry = await generateText({
      model,
      system,
      prompt: `${prompt}\n\nIMPORTANT: Write a COMPLETE post. Do not end mid-sentence.`,
      maxOutputTokens: 800,
      temperature: 0.5,
      abortSignal: timeoutSignal(),
    })
    result = retry.text.trim()
  }
  /* eslint-enable vercel-ai-security/require-validated-prompt, vercel-ai-security/no-dynamic-system-prompt */

  return result
}

/**
 * Generate a LinkedIn-optimised variant of an event. Longer-form, hook-first,
 * short-paragraph format tuned for the LinkedIn algorithm (dwell time, depth
 * score, niche expertise signals).
 */
export async function generateLinkedInPost(
  event: AgentEvent,
  angle: string,
  highlights: string,
  model: LanguageModel = defaultModel()
): Promise<string> {
  const charLimit = 3000
  const system = buildLinkedInSystemPrompt(event)
  const prompt = buildLinkedInPrompt(event, angle, highlights)

  /* eslint-disable vercel-ai-security/require-validated-prompt, vercel-ai-security/no-dynamic-system-prompt */
  const { text } = await generateText({
    model,
    system,
    prompt,
    maxOutputTokens: 2000,
    temperature: 0.75,
    abortSignal: timeoutSignal(),
  })
  let result = text.trim()

  // Retry if over budget or incomplete
  if (result.length > charLimit || !isComplete(result)) {
    const reason =
      result.length > charLimit
        ? `Your previous attempt was ${result.length} characters. Rewrite under ${charLimit} characters.`
        : `Your previous attempt ended mid-sentence. Rewrite it as a complete post with proper punctuation and hashtags.`
    const retry = await generateText({
      model,
      system,
      prompt: `${prompt}\n\nIMPORTANT: ${reason}`,
      maxOutputTokens: 2000,
      temperature: 0.5,
      abortSignal: timeoutSignal(),
    })
    const retryText = retry.text.trim()
    result =
      retryText.length <= charLimit && isComplete(retryText)
        ? retryText
        : truncateAtSentence(retryText.length > result.length ? retryText : result, charLimit)
  }
  /* eslint-enable vercel-ai-security/require-validated-prompt, vercel-ai-security/no-dynamic-system-prompt */

  return result
}

/**
 * Generate a per-platform post variant. Dispatches to the platform-specific
 * generator — LinkedIn gets long-form, Twitter/Bluesky get short-form with
 * platform-appropriate character budgets.
 *
 * Called only when a user explicitly clicks "Generate variant" for a platform
 * in the PostDetailModal; not part of the auto-publish flow.
 */
export type VariantPlatform = 'twitter' | 'linkedin' | 'bluesky'

export async function generatePlatformVariant(
  event: AgentEvent,
  platform: VariantPlatform,
  angle: string,
  highlights: string,
  model: LanguageModel = defaultModel()
): Promise<string | null> {
  if (platform === 'linkedin') {
    return generateLinkedInPost(event, angle, highlights, model)
  }
  return generateContent(event, angle, highlights, model, platform)
}

/**
 * Generate a weekly or branch recap. Takes pre-fetched GitHub activity
 * (commits, PRs, releases) from the caller and weaves it into a single post.
 */
export async function generateRecap(
  repoData: RepoRecapActivity[],
  recentPosts: RecentPost[],
  mode: 'week' | 'branch',
  tone: string,
  charLimit: number,
  projectContexts?: Map<string, string>,
  model: LanguageModel = defaultModel()
): Promise<string> {
  const system = buildRecapSystemPrompt(tone, charLimit, mode)
  const prompt = buildRecapPrompt(repoData, recentPosts, mode, projectContexts)

  /* eslint-disable vercel-ai-security/require-validated-prompt, vercel-ai-security/no-dynamic-system-prompt */
  const { text } = await generateText({
    model,
    system,
    prompt,
    maxOutputTokens: charLimit > 1000 ? 2000 : 600,
    temperature: 0.7,
    abortSignal: timeoutSignal(),
  })
  let result = text.trim()

  // Retry if over budget OR incomplete
  if (result.length > charLimit || !isComplete(result)) {
    const reason =
      result.length > charLimit
        ? `Your previous attempt was ${result.length} characters. Rewrite under ${charLimit} characters.`
        : `Your previous attempt ended mid-sentence. Rewrite it as a complete post with proper punctuation and hashtags.`
    const retry = await generateText({
      model,
      system,
      prompt: `${prompt}\n\nIMPORTANT: ${reason}`,
      maxOutputTokens: charLimit > 1000 ? 2000 : 600,
      temperature: 0.5,
      abortSignal: timeoutSignal(),
    })
    const retryText = retry.text.trim()
    result =
      retryText.length <= charLimit && isComplete(retryText)
        ? retryText
        : truncateAtSentence(retryText.length > result.length ? retryText : result, charLimit)
  }
  /* eslint-enable vercel-ai-security/require-validated-prompt, vercel-ai-security/no-dynamic-system-prompt */

  return result
}
