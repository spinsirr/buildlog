import { NextResponse } from 'next/server'
import { generateXhsPost } from '@/lib/agent/generators'
import type { AgentEvent } from '@/lib/agent/types'
import { verifyAgentSecret } from '../_auth'

/**
 * POST /api/agent/xhs
 *
 * Generate an XHS-style (emoji headers, segmented, hashtag) English variant
 * for a development update. Called from the generate-post edge fn when a
 * user clicks the XHS-copy button.
 */
export async function POST(req: Request) {
  const authError = verifyAgentSecret(req)
  if (authError) return authError

  const body = (await req.json()) as { event: AgentEvent; lang?: 'en' | 'zh' }
  if (!body?.event) {
    return NextResponse.json({ error: 'Missing event' }, { status: 400 })
  }

  const lang = body.lang === 'zh' ? 'zh' : 'en'

  try {
    const content = await generateXhsPost(body.event, lang)
    return NextResponse.json({ content })
  } catch (err) {
    console.error('[xhs] failed:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
