import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText, Output, stepCountIs, ToolLoopAgent, tool } from 'ai'
import { z } from 'zod'
import { getContentLimit } from '@/lib/platforms'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  AGENT_INSTRUCTIONS,
  buildContentPrompt,
  buildContentSystemPrompt,
  buildEventPrompt,
} from './prompts'
import type { AgentEvent, AgentResult } from './types'

const AGENT_MODEL = process.env.AGENT_MODEL ?? 'gemini-3-flash-preview'
const CONTENT_MODEL = process.env.CONTENT_MODEL ?? 'gemini-3-flash-preview'

/**
 * Create a Google AI provider with the project's existing API key.
 * The project uses GEMINI_API_KEY / GOOGLE_API_KEY, not the AI SDK default
 * GOOGLE_GENERATIVE_AI_API_KEY, so we configure it explicitly.
 */
function getGoogleProvider() {
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_API_KEY
  if (!apiKey)
    throw new Error(
      'Missing Google AI API key (set GOOGLE_GENERATIVE_AI_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY)'
    )
  return createGoogleGenerativeAI({ apiKey })
}

const agentResultSchema = z.object({
  decision: z.enum(['post', 'skip', 'bundle_later']),
  reasoning: z.string().describe('Multi-step reasoning explaining this decision'),
  confidence: z.enum(['high', 'medium', 'low']),
  angle: z.string().nullable().describe('The angle/hook for the post, if posting'),
  content: z.string().nullable().describe('The generated post content, if posting'),
})

const _agentToolNames = ['get_repo_context', 'get_recent_posts', 'generate_content'] as const

/** Default limits — used as fallback. Actual limits computed per-request from event.xPremium. */

export interface AgentOverrides {
  /** Replace all Supabase/Gemini-backed tools with mock implementations */
  // biome-ignore lint/suspicious/noExplicitAny: AI SDK tool types require any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: Record<string, any>
  /** Override the agent model (for testing with mock LLMs) */
  // biome-ignore lint/suspicious/noExplicitAny: AI SDK model types require any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model?: any
  /** Override the content model */
  // biome-ignore lint/suspicious/noExplicitAny: AI SDK model types require any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contentModel?: any
}

/**
 * Run the BuildLog agent for a GitHub event.
 *
 * The agent uses Gemini to reason about whether the event is worth posting,
 * gathers repo context plus recent posts, and if posting, generates content.
 * Returns a structured decision with reasoning trace.
 */
export async function runAgent(
  event: AgentEvent,
  overrides?: AgentOverrides
): Promise<AgentResult> {
  const supabase = overrides?.tools ? null : createAdminClient()
  const google = overrides?.model ? null : getGoogleProvider()

  // Create the agent per-request so tools close over the event context
  const agent = new ToolLoopAgent({
    model: overrides?.model ?? google!(AGENT_MODEL),
    instructions: AGENT_INSTRUCTIONS,
    stopWhen: stepCountIs(10),
    temperature: 0,
    output: Output.object({ schema: agentResultSchema }),

    tools: overrides?.tools ?? {
      get_repo_context: tool({
        description:
          'Get the current repository context for this event. Use this alongside the GitHub event details before deciding.',
        inputSchema: z.object({}),
        execute: async () => ({
          projectContext: event.projectContext,
          repoName: event.repoName,
          tone: event.tone,
        }),
      }),

      get_recent_posts: tool({
        description:
          'Get recent posts for this repo to avoid duplicate angles and maintain narrative variety.',
        inputSchema: z.object({
          limit: z.number().optional().describe('Number of recent posts (default 5)'),
        }),
        execute: async ({ limit = 5 }) => {
          const { data } = await supabase!
            .from('posts')
            .select('content, source_type, created_at')
            .eq('user_id', event.userId)
            .eq('repo_id', event.repoId)
            .in('status', ['published', 'draft'])
            .order('created_at', { ascending: false })
            .limit(limit)
          return { posts: data ?? [], count: data?.length ?? 0 }
        },
      }),

      generate_content: tool({
        description:
          'Generate post content using Gemini with the specified angle and highlights. Call this when you decide to post. Returns the generated text.',
        inputSchema: z.object({
          angle: z.string().describe('The specific angle or hook for the post'),
          highlights: z.string().describe('Key points to emphasize'),
        }),
        execute: async ({ angle, highlights }) => {
          const contentBudget = getContentLimit('twitter', event.xPremium)
          const systemPrompt = buildContentSystemPrompt(event.tone, contentBudget)
          const userPrompt = buildContentPrompt(event, angle, highlights)

          const { text } = await generateText({
            model: google!(CONTENT_MODEL),
            system: systemPrompt,
            prompt: userPrompt,
            maxOutputTokens: event.xPremium ? 2000 : 800,
            temperature: 0.7,
          })

          let content = text.trim()

          // Guard: empty or too-short output
          if (content.length < 10) {
            return { content: null, error: 'Generated content was empty or too short' }
          }

          // Retry if over budget (watermark-aware)
          if (content.length > contentBudget) {
            const retry = await generateText({
              model: google!(CONTENT_MODEL),
              system: systemPrompt,
              prompt: `${userPrompt}\n\nIMPORTANT: Your previous attempt was ${content.length} characters. Rewrite under ${contentBudget} characters while keeping it complete and engaging.`,
              maxOutputTokens: event.xPremium ? 2000 : 800,
              temperature: 0.5,
            })
            const retryText = retry.text.trim()
            if (retryText.length <= contentBudget) {
              content = retryText
            } else {
              // Force-truncate to last sentence boundary
              const match = retryText.slice(0, contentBudget).match(/^([\s\S]*[.!?])(\s*#\S+)*/)
              content = match ? match[0].trim() : `${retryText.slice(0, contentBudget - 1)}\u2026`
            }
          }

          return { content, lengthBeforeWatermark: content.length }
        },
      }),
    },
  })

  const result = await agent.generate({
    prompt: buildEventPrompt(event),
  })

  if (
    result.output.decision === 'post' &&
    // biome-ignore lint/suspicious/noExplicitAny: AI SDK step internals not typed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !result.steps.some((step: any) => {
      const toolCalls = step?.toolCalls ?? []
      return (
        Array.isArray(toolCalls) &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toolCalls.some((call: any) => call.toolName === 'generate_content')
      )
    })
  ) {
    throw new Error('Agent post decision must use generate_content after gathering context')
  }

  return {
    decision: result.output.decision,
    reasoning: result.output.reasoning,
    confidence: result.output.confidence,
    angle: result.output.angle,
    content: result.output.content,
    stepCount: result.steps.length,
  }
}

/**
 * Run the agent with error handling. On failure, returns an error decision
 * so failures are visible in the dashboard rather than producing low-quality fallback posts.
 */
export async function runAgentSafe(
  event: AgentEvent,
  overrides?: AgentOverrides
): Promise<AgentResult> {
  try {
    return await runAgent(event, overrides)
  } catch (err) {
    console.error('[agent] failed:', err instanceof Error ? err.message : String(err))
    return {
      decision: 'error',
      reasoning: `Agent error: ${err instanceof Error ? err.message : String(err)}`,
      confidence: 'low',
      angle: null,
      content: null,
      stepCount: 0,
    }
  }
}
