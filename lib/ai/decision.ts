import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { DECISION_SYSTEM_PROMPT } from './prompts'
import type { DecisionInput, DecisionOutput } from './schemas'

// ---------------------------------------------------------------------------
// AI SDK-backed decision engine
// ---------------------------------------------------------------------------

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY,
})

/**
 * Evaluate a GitHub event and decide whether it's worth posting about.
 * Uses AI SDK generateText with Output.object for typed structured output.
 */
export async function decide(input: DecisionInput): Promise<DecisionOutput> {
  const prompt = buildDecisionPrompt(input)

  const { output } = await generateText({
    model: google('gemini-2.5-flash'),
    system: buildSystemPromptWithContext(input),
    prompt,
    temperature: 0.3,
    maxOutputTokens: 400,
    output: Output.object({
      schema: z.object({
        decision: z.enum(['post', 'skip', 'bundle_later']),
        reason: z.string().describe('Brief explanation of why this decision was made'),
        confidence: z.enum(['high', 'medium', 'low']),
        angle: z
          .string()
          .nullable()
          .describe("If decision is 'post', a compelling angle/hook for the post. Otherwise null."),
        suggestedPlatforms: z
          .array(z.string())
          .optional()
          .describe('Suggested platforms based on content type'),
      }),
    }),
  })

  if (!output) {
    return {
      decision: 'post',
      reason: 'Decision engine returned no output — defaulting to post',
      confidence: 'low',
      angle: null,
    }
  }

  return output
}

function buildSystemPromptWithContext(input: DecisionInput): string {
  const parts = [DECISION_SYSTEM_PROMPT]

  // Inject product context if available
  if (input.productContext) {
    const ctx = input.productContext
    const contextParts: string[] = []
    if (ctx.productSummary) contextParts.push(`Product: ${ctx.productSummary}`)
    if (ctx.targetAudience) contextParts.push(`Audience: ${ctx.targetAudience}`)
    if (ctx.currentNarrative) contextParts.push(`Current narrative: ${ctx.currentNarrative}`)
    if (ctx.topicsToEmphasize?.length)
      contextParts.push(`Emphasize: ${ctx.topicsToEmphasize.join(', ')}`)
    if (ctx.topicsToAvoid?.length) contextParts.push(`Avoid: ${ctx.topicsToAvoid.join(', ')}`)
    if (ctx.lastPostAngle)
      contextParts.push(`Last post angle (avoid repeating): ${ctx.lastPostAngle}`)

    if (contextParts.length > 0) {
      parts.push(`\n\nProduct context:\n${contextParts.join('\n')}`)
    }
  }

  // Inject recent decision history for learning
  if (input.recentDecisions?.length) {
    const historyLines = input.recentDecisions
      .slice(0, 5)
      .map((d) => `- ${d.sourceType}: ${d.decision} — ${d.reason}`)
    parts.push(`\n\nRecent decisions for this repo:\n${historyLines.join('\n')}`)
  }

  return parts.join('')
}

function buildDecisionPrompt(input: DecisionInput): string {
  const parts: string[] = []

  parts.push(`Event type: ${input.sourceType}`)
  parts.push(`Repository: ${input.repoName}`)

  if (input.data.message) parts.push(`Commit message: "${input.data.message}"`)
  if (input.data.title) parts.push(`Title: "${input.data.title}"`)
  if (input.data.description) parts.push(`Description: "${input.data.description.slice(0, 500)}"`)

  if (input.data.additions !== undefined || input.data.deletions !== undefined) {
    parts.push(
      `Scale: +${input.data.additions ?? 0} -${input.data.deletions ?? 0} lines, ${input.data.filesChanged ?? '?'} files`
    )
  }

  if (input.data.commitMessages?.length) {
    const msgs = input.data.commitMessages.slice(0, 10).join('\n- ')
    parts.push(`Commits:\n- ${msgs}`)
  }

  if (input.data.files?.length) {
    const fileList = input.data.files.slice(0, 15).join(', ')
    parts.push(`Files: ${fileList}`)
  }

  if (input.projectContext) {
    parts.push(`Project context: ${input.projectContext.slice(0, 800)}`)
  }

  return parts.join('\n')
}
