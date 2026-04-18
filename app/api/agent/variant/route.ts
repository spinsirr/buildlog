import { NextResponse } from 'next/server'
import { generatePlatformVariant, type VariantPlatform } from '@/lib/agent/generators'
import type { AgentEvent } from '@/lib/agent/types'
import { verifyAgentSecret } from '../_auth'

const VALID_PLATFORMS: VariantPlatform[] = ['twitter', 'linkedin', 'bluesky']

/**
 * POST /api/agent/variant
 *
 * Generate a platform-specific variant of a post. Called from the
 * generate-post edge fn when a user clicks "Generate variant" in the
 * PostDetailModal. Returns only the content string — the edge fn is
 * responsible for persisting it into posts.platform_variants[platform].
 */
export async function POST(req: Request) {
  const authError = verifyAgentSecret(req)
  if (authError) return authError

  const body = (await req.json()) as {
    event: AgentEvent
    platform: string
    angle?: string
    highlights?: string
  }
  if (!body?.event || !body?.platform) {
    return NextResponse.json({ error: 'Missing event or platform' }, { status: 400 })
  }
  if (!VALID_PLATFORMS.includes(body.platform as VariantPlatform)) {
    return NextResponse.json(
      { error: `platform must be one of: ${VALID_PLATFORMS.join(', ')}` },
      { status: 400 }
    )
  }

  const angle = body.angle || 'shipping update'
  const highlights = body.highlights || ''

  try {
    const content = await generatePlatformVariant(
      body.event,
      body.platform as VariantPlatform,
      angle,
      highlights
    )
    if (!content) {
      return NextResponse.json({ error: 'Generation produced empty output' }, { status: 500 })
    }
    return NextResponse.json({ content })
  } catch (err) {
    console.error('[variant] failed:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
