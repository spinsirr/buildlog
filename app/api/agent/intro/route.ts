import { NextResponse } from 'next/server'
import { generateIntroPost } from '@/lib/agent/generators'
import { verifyAgentSecret } from '../_auth'

/**
 * POST /api/agent/intro
 *
 * Generate an introductory post for a newly connected repo. Called from
 * connect-repo / backfill-context edge fns.
 */
export async function POST(req: Request) {
  const authError = verifyAgentSecret(req)
  if (authError) return authError

  const body = (await req.json()) as {
    repoName?: string
    projectContext?: string
    tone?: 'casual' | 'professional' | 'technical'
    contentBudget?: number
  }

  if (!body?.repoName || !body?.projectContext) {
    return NextResponse.json(
      { error: 'Missing repoName or projectContext' },
      { status: 400 }
    )
  }

  try {
    const content = await generateIntroPost(
      body.repoName,
      body.projectContext,
      body.tone ?? 'casual',
      body.contentBudget ?? 280
    )
    return NextResponse.json({ content })
  } catch (err) {
    console.error('[intro] failed:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
