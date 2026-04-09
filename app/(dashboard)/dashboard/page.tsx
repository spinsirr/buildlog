import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Post } from '@/lib/types'
import { calculateStreak } from '@/lib/utils'
import { DashboardClient } from './dashboard-client'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: repos }, { data: posts }, { count: connectionsCount }, { data: streakPosts }] =
    await Promise.all([
      supabase.from('connected_repos').select('*').eq('user_id', user.id),
      supabase
        .from('posts')
        .select('*, connected_repos(full_name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('platform_connections')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('posts')
        .select('created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100),
    ])

  const allPosts = (posts ?? []) as Post[]
  const drafts = allPosts.filter((p) => p.status === 'draft')
  const published = allPosts.filter((p) => p.status === 'published')
  const streak = calculateStreak((streakPosts as { created_at: string }[]) ?? [])

  const stats = [
    { label: 'Connected Repos', value: repos?.length ?? 0 },
    { label: 'Draft Posts', value: drafts.length },
    { label: 'Published', value: published.length },
    { label: 'Streak Days', value: streak },
  ]

  return (
    <DashboardClient
      stats={stats}
      posts={allPosts}
      hasRepos={(repos?.length ?? 0) > 0}
      hasSocial={(connectionsCount ?? 0) > 0}
    />
  )
}
