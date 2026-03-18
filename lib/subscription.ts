import { createClient } from '@/lib/supabase/server'
import { PLANS, type Plan } from '@/lib/plans'

export async function getUserPlan(userId: string): Promise<Plan> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .single()

  if (data?.status === 'active') return 'pro'
  return 'free'
}

type LimitType = 'posts' | 'repos' | 'platforms'

export async function checkLimit(
  userId: string,
  type: LimitType
): Promise<{ allowed: boolean; plan: Plan; count: number; limit: number }> {
  const supabase = await createClient()
  const plan = await getUserPlan(userId)
  const limits = PLANS[plan]

  let count = 0

  if (type === 'posts') {
    const { count: c } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
    count = c ?? 0
  } else if (type === 'repos') {
    const { count: c } = await supabase
      .from('connected_repos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true)
    count = c ?? 0
  } else if (type === 'platforms') {
    const { count: c } = await supabase
      .from('platform_connections')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
    count = c ?? 0
  }

  const limit = limits[`${type}_per_month` as keyof typeof limits] as number ?? limits[type as keyof typeof limits] as number
  const allowed = plan === 'pro' || count < limit

  return { allowed, plan, count, limit }
}
