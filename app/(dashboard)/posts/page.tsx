'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { ErrorState } from '@/components/error-state'
import { PostsClient } from '@/components/posts-client'
import { createClient } from '@/lib/supabase/client'
import { PostsSkeleton } from './loading'

function usePostsData() {
  const supabase = useMemo(() => createClient(), [])
  return useSWR('posts-data', async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const [{ data: posts }, { data: connectionRows }] = await Promise.all([
      supabase
        .from('posts')
        .select('*, connected_repos(full_name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('platform_connections').select('platform').eq('user_id', user.id),
    ])

    const connectedPlatforms = (connectionRows ?? []).map((r: { platform: string }) => r.platform)

    return {
      posts: posts ?? [],
      connectedPlatforms,
    }
  })
}

export default function PostsPage() {
  const { data, error, isLoading, mutate } = usePostsData()

  if (isLoading) return <PostsSkeleton />
  if (error || !data) return <ErrorState retry={() => mutate()} />

  return (
    <PostsClient initialPosts={data.posts} initialConnectedPlatforms={data.connectedPlatforms} />
  )
}
