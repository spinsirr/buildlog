import { generateObject, wrapLanguageModel } from 'ai'
import { z } from 'zod'
import { guardrailMiddleware, timeoutSignal } from '@/lib/ai/middleware'
import { getGoogleProvider, type LanguageModel } from '@/lib/ai/provider'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateContent as _generateContent } from './generators'
import { buildRankerPrompt, RANKER_INSTRUCTIONS } from './prompts'
import type { AgentEvent, AgentResult, RecentPost } from './types'

const RANKER_MODEL = process.env.AGENT_MODEL ?? 'gemini-3-flash-preview'

const rankerSchema = z.object({
  signal: z.enum(['high', 'low']),
  confidence: z.enum(['high', 'medium', 'low']),
  angle: z.string().min(1).describe('Specific, opinionated hook for the post'),
  reasoning: z.string().min(1).describe('1-2 sentences explaining the rating'),
})

export interface AgentOverrides {
  /** Override the ranker model (for testing with mock LLMs) */
  rankerModel?: LanguageModel
  /** Override the content model */
  contentModel?: LanguageModel
  /** Skip the DB fetch for recent posts (used in tests / when caller pre-fetched) */
  skipRecentPostsFetch?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchRecentPosts(userId: string, repoId: string, limit = 5): Promise<RecentPost[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('posts')
    .select('content, source_type, created_at')
    .eq('user_id', userId)
    .eq('repo_id', repoId)
    .in('status', ['published', 'draft'])
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as RecentPost[]
}

function wrappedModel(model: LanguageModel) {
  return wrapLanguageModel({ model, middleware: guardrailMiddleware })
}

// ─── Phase 1: rank ────────────────────────────────────────────────────────────

async function rankEvent(
  event: AgentEvent,
  overrides?: AgentOverrides
): Promise<{
  signal: 'high' | 'low'
  confidence: 'high' | 'medium' | 'low'
  angle: string
  reasoning: string
}> {
  const google = overrides?.rankerModel ? null : getGoogleProvider()
  const model = overrides?.rankerModel ?? wrappedModel(google!(RANKER_MODEL))

  const recentPosts = event.recentPosts ?? []

  /* eslint-disable vercel-ai-security/require-validated-prompt, vercel-ai-security/no-dynamic-system-prompt -- prompts are constructed from trusted server-side data */
  const { object } = await generateObject({
    model,
    system: RANKER_INSTRUCTIONS,
    prompt: buildRankerPrompt(event, recentPosts),
    schema: rankerSchema,
    temperature: 0,
    abortSignal: timeoutSignal(),
  })
  /* eslint-enable vercel-ai-security/require-validated-prompt, vercel-ai-security/no-dynamic-system-prompt */

  return object
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * Run the ranker + content generation pipeline for a GitHub event.
 *
 * Architecture:
 *   1. Ranker call — compact prompt, no full diff, outputs {signal, angle}
 *   2. Content call — full diff + angle, outputs post text
 *
 * This replaces the old ToolLoopAgent (gatekeeper) design: every event
 * produces a draft, and `signal` tells the UI how prominently to show it.
 *
 * Token cost (rough):
 *   - ranker:  ~2000 input + ~200 output
 *   - content: ~4000 input + ~100 output
 * vs. old ToolLoopAgent which accumulated ~24,000 input tokens per POST.
 */
export async function runAgent(
  event: AgentEvent,
  overrides?: AgentOverrides
): Promise<AgentResult> {
  // Pre-fetch recent posts if the caller didn't
  if (!event.recentPosts && !overrides?.skipRecentPostsFetch) {
    event = {
      ...event,
      recentPosts: await fetchRecentPosts(event.userId, event.repoId),
    }
  }

  // Phase 1: rank
  const ranking = await rankEvent(event, overrides)

  // Phase 2: generate content (always — every event → draft)
  const highlights = `Signal: ${ranking.signal}. ${ranking.reasoning}`
  const content = await _generateContent(event, ranking.angle, highlights, overrides?.contentModel)

  return {
    signal: ranking.signal,
    confidence: ranking.confidence,
    angle: ranking.angle,
    reasoning: ranking.reasoning,
    content,
    stepCount: 2,
  }
}

/**
 * Run the pipeline with error handling. On failure returns a result with
 * signal 'error' so the caller (webhook) knows to fall back to direct
 * generation without the ranker's angle.
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
      signal: 'error',
      reasoning: `Agent error: ${err instanceof Error ? err.message : String(err)}`,
      confidence: 'low',
      angle: null,
      content: null,
      stepCount: 0,
    }
  }
}
