import { NextResponse } from 'next/server'
import { runAgentSafe } from '@/lib/agent/orchestrator'
import type { AgentEvent } from '@/lib/agent/types'

/**
 * POST /api/agent/decide
 *
 * Vercel Function that runs the BuildLog agent for a GitHub event.
 * Called by the Supabase github-webhook edge function when decision_layer_enabled.
 * Authenticated via a shared secret (AGENT_API_SECRET).
 */
export async function POST(req: Request) {
  const secret = req.headers.get('x-agent-secret')
  if (!secret || secret !== process.env.AGENT_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify required env vars for the agent
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const geminiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_API_KEY
  if (!geminiKey) {
    return NextResponse.json({ error: 'Google AI API key not configured' }, { status: 500 })
  }

  const event: AgentEvent = await req.json()

  const result = await runAgentSafe(event)

  return NextResponse.json(result)
}
