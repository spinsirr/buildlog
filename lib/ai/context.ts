import { createServerSupabaseClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Context retrieval — fetches product context and decision history from
// Supabase. These functions are designed to become AI SDK tools in Phase 3.
// ---------------------------------------------------------------------------

export interface ProductContext {
  productSummary: string | null
  targetAudience: string | null
  currentNarrative: string | null
  topicsToEmphasize: string[]
  topicsToAvoid: string[]
  lastPostAngle: string | null
}

export interface RecentDecision {
  decision: string
  reason: string
  sourceType: string
  angle: string | null
  createdAt: string
}

export interface RecentPost {
  content: string
  sourceType: string
  createdAt: string
}

/**
 * Fetch structured product context for a repo.
 * Falls back to the auto-generated project_context from connected_repos.
 */
export async function getProductContext(
  userId: string,
  repoId: string
): Promise<ProductContext | null> {
  const supabase = await createServerSupabaseClient()

  const { data } = await supabase
    .from('product_context')
    .select(
      'product_summary, target_audience, current_narrative, topics_to_emphasize, topics_to_avoid, last_post_angle'
    )
    .eq('user_id', userId)
    .eq('repo_id', repoId)
    .single()

  if (!data) return null

  return {
    productSummary: data.product_summary,
    targetAudience: data.target_audience,
    currentNarrative: data.current_narrative,
    topicsToEmphasize: data.topics_to_emphasize ?? [],
    topicsToAvoid: data.topics_to_avoid ?? [],
    lastPostAngle: data.last_post_angle,
  }
}

/**
 * Fetch recent post decisions for a repo (last N decisions).
 * Used as context for the decision engine to avoid repetitive decisions
 * and learn from user overrides.
 */
export async function getRecentDecisions(
  userId: string,
  repoId: string,
  limit = 10
): Promise<RecentDecision[]> {
  const supabase = await createServerSupabaseClient()

  const { data } = await supabase
    .from('post_decisions')
    .select('decision, reason, source_type, angle, created_at')
    .eq('user_id', userId)
    .eq('repo_id', repoId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!data) return []

  return data.map((d) => ({
    decision: d.decision,
    reason: d.reason,
    sourceType: d.source_type,
    angle: d.angle,
    createdAt: d.created_at,
  }))
}

/**
 * Fetch recent posts for a repo to avoid duplicate angles.
 */
export async function getRecentPosts(
  userId: string,
  repoId: string,
  limit = 5
): Promise<RecentPost[]> {
  const supabase = await createServerSupabaseClient()

  const { data } = await supabase
    .from('posts')
    .select('content, source_type, created_at')
    .eq('user_id', userId)
    .eq('repo_id', repoId)
    .in('status', ['draft', 'published'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!data) return []

  return data.map((p) => ({
    content: p.content,
    sourceType: p.source_type,
    createdAt: p.created_at,
  }))
}
