import { redirect } from 'next/navigation'
import { PostsClient } from '@/components/posts-client'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function PostsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: posts }, { data: connectionRows }, { data: profile }] = await Promise.all([
    supabase
      .from('posts')
      .select('*, connected_repos(full_name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('platform_connections').select('platform').eq('user_id', user.id),
    supabase.from('profiles').select('x_premium').eq('id', user.id).single(),
  ])

  const connectedPlatforms = (connectionRows ?? []).map((r: { platform: string }) => r.platform)
  const xPremium = profile?.x_premium ?? false

  return (
    <PostsClient
      initialPosts={posts ?? []}
      initialConnectedPlatforms={connectedPlatforms}
      xPremium={xPremium}
    />
  )
}
