import { NextResponse } from 'next/server'
import { generateRecap } from '@/lib/agent/generators'
import type { RepoRecapActivity } from '@/lib/agent/prompts'
import type { RecentPost } from '@/lib/agent/types'
import { verifyAgentSecret } from '../_auth'

/**
 * POST /api/agent/recap
 *
 * Generate a weekly or feature-branch recap from pre-fetched GitHub activity.
 * Caller (generate-recap edge fn) fetches commits/PRs/releases from GitHub
 * and supplies them here — this route stays AI-only, no external I/O.
 */
export async function POST(req: Request) {
  const authError = verifyAgentSecret(req)
  if (authError) return authError

  const body = (await req.json()) as {
    repoData?: RepoRecapActivity[]
    recentPosts?: RecentPost[]
    mode?: 'week' | 'branch'
    tone?: string
    charLimit?: number
    projectContexts?: Record<string, string>
  }

  if (!Array.isArray(body?.repoData)) {
    return NextResponse.json({ error: 'Missing repoData' }, { status: 400 })
  }

  try {
    const projectContexts = body.projectContexts
      ? new Map(Object.entries(body.projectContexts))
      : undefined

    const content = await generateRecap(
      body.repoData,
      body.recentPosts ?? [],
      body.mode ?? 'week',
      body.tone ?? 'casual',
      body.charLimit ?? 280,
      projectContexts
    )
    return NextResponse.json({ content })
  } catch (err) {
    console.error('[recap] failed:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
