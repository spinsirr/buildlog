'use client'

import { PostsClient } from '@/components/posts-client'
import { usePostsData } from '@/lib/hooks/use-dashboard-data'
import { PostsSkeleton } from './loading'

export default function PostsPage() {
  const { data, isLoading } = usePostsData()

  if (isLoading || !data) return <PostsSkeleton />

  return (
    <PostsClient
      initialPosts={data.posts}
      initialConnectedPlatforms={data.connectedPlatforms}
      xPremium={data.xPremium}
    />
  )
}
