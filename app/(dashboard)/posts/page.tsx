'use client'

import { FetchError } from '@/components/fetch-error'
import { PostsClient } from '@/components/posts-client'
import { usePostsData } from '@/lib/hooks/use-dashboard-data'
import { PostsSkeleton } from './loading'

export default function PostsPage() {
  const { data, error, isLoading, mutate } = usePostsData()

  if (isLoading || !data) return <PostsSkeleton />
  if (error) return <FetchError onRetry={() => mutate()} />

  return <PostsClient />
}
