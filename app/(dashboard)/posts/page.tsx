'use client'

import useSWR from 'swr'
import { PostsClient } from '@/components/posts-client'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

async function fetchPostsData() {
  const [{ data: posts }, { data: connectionRows }] = await Promise.all([
    supabase
      .from('posts')
      .select('*, connected_repos(full_name)')
      .order('created_at', { ascending: false }),
    supabase.from('platform_connections').select('platform'),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connectedPlatforms = (connectionRows ?? []).map((r: any) => r.platform as string)

  return {
    posts: posts ?? [],
    connectedPlatforms,
  }
}

function PostsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-7 w-24 rounded-md" />
      </div>
      <Skeleton className="h-9 w-64 rounded-md" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-zinc-900 border border-zinc-800 p-5 space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-px w-full" />
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <div className="flex gap-1">
                <Skeleton className="h-7 w-7 rounded-md" />
                <Skeleton className="h-7 w-7 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ErrorState({ retry }: { retry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
        <span className="text-red-400 text-lg">!</span>
      </div>
      <p className="text-sm text-zinc-400">Something went wrong loading posts.</p>
      <button
        type="button"
        onClick={retry}
        className="px-4 py-2 text-sm rounded-md bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}

export default function PostsPage() {
  const { data, error, isLoading, mutate } = useSWR('posts-data', fetchPostsData)

  if (isLoading) return <PostsSkeleton />
  if (error || !data) return <ErrorState retry={() => mutate()} />

  return (
    <PostsClient
      initialPosts={data.posts}
      initialConnectedPlatforms={data.connectedPlatforms}
    />
  )
}
