import { NextResponse } from 'next/server'
import { generateLinkedInPost } from '@/lib/agent/generators'
import type { AgentEvent } from '@/lib/agent/types'
import { verifyAgentSecret } from '../_auth'

/**
 * POST /api/agent/linkedin
 *
 * Generate a LinkedIn-optimised variant (hook-first, short paragraphs,
 * depth-score-friendly) for a development update. Called from the
 * generate-post edge fn when a user clicks the LinkedIn copy button.
 */
export async function POST(req: Request) {
  const authError = verifyAgentSecret(req)
  if (authError) return authError

  const body = (await req.json()) as { event: AgentEvent; angle: string; highlights: string }
  if (!body?.event) {
    return NextResponse.json({ error: 'Missing event' }, { status: 400 })
  }

  const angle = body.angle || 'shipping update'
  const highlights = body.highlights || ''

  try {
    const content = await generateLinkedInPost(body.event, angle, highlights)
    return NextResponse.json({ content })
  } catch (err) {
    console.error('[linkedin] failed:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
