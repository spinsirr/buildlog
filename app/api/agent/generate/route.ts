import { NextResponse } from 'next/server'
import { generateContent } from '@/lib/agent/generators'
import type { AgentEvent } from '@/lib/agent/types'
import { verifyAgentSecret } from '../_auth'

/**
 * POST /api/agent/generate
 *
 * Generate post content for an event with a given angle + highlights.
 * Used by:
 *   - github-webhook edge fn as fallback when the ranker is off/unavailable
 *   - generate-post/regenerate flow when a user clicks regenerate
 *
 * Authenticated via shared secret (AGENT_API_SECRET).
 */
export async function POST(req: Request) {
  const authError = verifyAgentSecret(req)
  if (authError) return authError

  const body = (await req.json()) as {
    event: AgentEvent
    angle?: string
    highlights?: string
  }

  if (!body?.event) {
    return NextResponse.json({ error: 'Missing event' }, { status: 400 })
  }

  try {
    const content = await generateContent(
      body.event,
      body.angle ?? 'shipping update',
      body.highlights ?? ''
    )
    return NextResponse.json({ content })
  } catch (err) {
    console.error('[generate] failed:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
