import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText, Output, stepCountIs, ToolLoopAgent, tool } from 'ai'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  AGENT_INSTRUCTIONS,
  buildContentPrompt,
  buildContentSystemPrompt,
  buildEventPrompt,
  WATERMARK,
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
  decision: z.enum(['post', 'skip']),
  reasoning: z.string().describe('Multi-step reasoning explaining this decision'),
  confidence: z.enum(['high', 'medium', 'low']),
  angle: z.string().nullable().describe('The angle/hook for the post, if posting'),
  content: z.string().nullable().describe('The generated post content, if posting'),
})

/** Max content length including the watermark suffix */
const MAX_CONTENT_LENGTH = 280
const CONTENT_BUDGET = MAX_CONTENT_LENGTH - WATERMARK.length

/**
 * Run the BuildLog agent for a GitHub event.
 *
 * The agent uses Gemini to reason about whether the event is worth posting,
 * gathers context from product memory and history, and if posting, generates
 * content. Returns a structured decision with reasoning trace.
 */
export async function runAgent(event: AgentEvent): Promise<AgentResult> {
  const supabase = createAdminClient()
  const google = getGoogleProvider()

  // Create the agent per-request so tools close over the event context
  const agent = new ToolLoopAgent({
    model: google(AGENT_MODEL),
    instructions: AGENT_INSTRUCTIONS,
    stopWhen: stepCountIs(10),
    temperature: 0,
    output: Output.object({ schema: agentResultSchema }),

    tools: {
      get_product_context: tool({
        description:
          'Retrieve stored product memory and project context for this repository. Call this first to understand the project.',
        inputSchema: z.object({}),
        execute: async () => {
          const { data: memory } = await supabase
            .from('agent_memory')
            .select('key, value, category, updated_at')
            .eq('user_id', event.userId)
            .eq('repo_id', event.repoId)
            .order('updated_at', { ascending: false })
            .limit(20)

          return {
            memory: memory ?? [],
            projectContext: event.projectContext,
            repoName: event.repoName,
            tone: event.tone,
          }
        },
      }),

      get_decision_history: tool({
        description:
          'Get recent AI decisions for this repo to learn from patterns. Shows what was posted or skipped.',
        inputSchema: z.object({
          limit: z.number().optional().describe('Number of recent decisions (default 10)'),
        }),
        execute: async ({ limit = 10 }) => {
          const { data } = await supabase
            .from('post_decisions')
            .select('decision, reason, source_type, angle, confidence, created_at')
            .eq('user_id', event.userId)
            .eq('repo_id', event.repoId)
            .order('created_at', { ascending: false })
            .limit(limit)
          return { decisions: data ?? [], count: data?.length ?? 0 }
        },
      }),

      get_recent_posts: tool({
        description:
          'Get recent posts for this repo to avoid duplicate angles and maintain narrative variety.',
        inputSchema: z.object({
          limit: z.number().optional().describe('Number of recent posts (default 5)'),
        }),
        execute: async ({ limit = 5 }) => {
          const { data } = await supabase
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
          const systemPrompt = buildContentSystemPrompt(event.tone)
          const userPrompt = buildContentPrompt(event, angle, highlights)

          const { text } = await generateText({
            model: google(CONTENT_MODEL),
            system: systemPrompt,
            prompt: userPrompt,
            maxOutputTokens: 800,
            temperature: 0.7,
          })

          let content = text.trim()

          // Guard: empty or too-short output
          if (content.length < 10) {
            return { content: null, error: 'Generated content was empty or too short' }
          }

          // Retry if over budget (watermark-aware)
          if (content.length > CONTENT_BUDGET) {
            const retry = await generateText({
              model: google(CONTENT_MODEL),
              system: systemPrompt,
              prompt: `${userPrompt}\n\nIMPORTANT: Your previous attempt was ${content.length} characters. Rewrite under ${CONTENT_BUDGET} characters while keeping it complete and engaging.`,
              maxOutputTokens: 800,
              temperature: 0.5,
            })
            const retryText = retry.text.trim()
            if (retryText.length <= CONTENT_BUDGET) {
              content = retryText
            } else {
              // Force-truncate to last sentence boundary
              const match = retryText.slice(0, CONTENT_BUDGET).match(/^([\s\S]*[.!?])(\s*#\S+)*/)
              content = match ? match[0].trim() : retryText.slice(0, CONTENT_BUDGET - 1) + '\u2026'
            }
          }

          // Append watermark — total is guaranteed ≤ MAX_CONTENT_LENGTH
          content = content + WATERMARK

          return { content, lengthBeforeWatermark: content.length - WATERMARK.length }
        },
      }),

      update_product_memory: tool({
        description:
          'Update durable product memory. Call when you learn something new about the project from the code changes — what it does, who uses it, current development theme, etc.',
        inputSchema: z.object({
          updates: z.array(
            z.object({
              key: z
                .string()
                .describe('Memory key (e.g. "product_description", "current_theme", "tech_stack")'),
              value: z.string().describe('The value to store'),
              category: z.enum(['product_identity', 'narrative', 'audience', 'pattern']),
            })
          ),
        }),
        execute: async ({ updates }) => {
          for (const update of updates) {
            await supabase.from('agent_memory').upsert(
              {
                user_id: event.userId,
                repo_id: event.repoId,
                key: update.key,
                value: update.value,
                category: update.category,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,repo_id,key' }
            )
          }
          return { updated: updates.length }
        },
      }),
    },
  })

  const result = await agent.generate({
    prompt: buildEventPrompt(event),
  })

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
export async function runAgentSafe(event: AgentEvent): Promise<AgentResult> {
  try {
    return await runAgent(event)
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
