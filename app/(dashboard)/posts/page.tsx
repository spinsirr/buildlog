import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PostsClient } from '@/components/posts-client'

export const metadata: Metadata = { title: 'Posts' }

export default async function PostsPage() {
  const supabase = await createServerSupabaseClient()

  const [{ data: posts }, { data: connectionRows }] = await Promise.all([
    supabase
      .from('posts')
      .select('*, connected_repos(full_name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('platform_connections')
      .select('platform'),
  ])

  const connectedPlatforms = (connectionRows ?? []).map(r => r.platform)

  return (
    <PostsClient
      initialPosts={posts ?? []}
      initialConnectedPlatforms={connectedPlatforms}
    />
  )
}
