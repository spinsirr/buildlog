import { NextResponse } from 'next/server'
import { runAgentSafe } from '@/lib/agent/orchestrator'
import type { AgentEvent } from '@/lib/agent/types'
import { verifyAgentSecret } from '../_auth'

/**
 * POST /api/agent/decide
 *
 * Vercel Function that runs the BuildLog ranker + content pipeline for a
 * GitHub event. Called by the Supabase github-webhook edge function.
 * Returns { signal, confidence, angle, reasoning, content } — every event
 * produces a draft; `signal` tells the UI how to surface it.
 * Authenticated via a shared secret (AGENT_API_SECRET).
 */
export async function POST(req: Request) {
  const authError = verifyAgentSecret(req)
  if (authError) return authError

  // Verify required env vars for the agent
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
