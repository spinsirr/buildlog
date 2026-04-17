'use client'

import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { platformConfig } from '@/lib/platforms'
import type { Post } from '@/lib/types'
import { cn, draftAgeBucket, draftAgeText, timeAgo } from '@/lib/utils'

/** Top badges: status, source type, signal, repo */
export function PostCardBadges({ post }: { post: Post }) {
  const commitHash =
    post.source_data && typeof post.source_data === 'object' && 'url' in post.source_data
      ? (post.source_data.url as string)?.split('/').pop()?.slice(0, 7)
      : null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge
        variant="secondary"
        className={cn(
          'text-[10px] border-0',
          post.status === 'published'
            ? 'bg-emerald-500/10 text-emerald-400'
            : post.status === 'draft'
              ? 'bg-amber-500/10 text-amber-400'
              : 'bg-zinc-800 text-zinc-400'
        )}
      >
        {post.status}
      </Badge>
      <Badge
        variant="secondary"
        className={cn(
          'text-[10px] border-0',
          post.source_type === 'intro'
            ? 'bg-neo-muted/10 text-neo-muted'
            : 'bg-zinc-800 text-zinc-400'
        )}
      >
        {post.source_type === 'intro' ? 'intro' : post.source_type}
      </Badge>
      {post.signal && (
        <Badge
          variant="secondary"
          className={cn(
            'text-[10px] border-0',
            post.signal === 'high'
              ? 'bg-neo-accent/10 text-neo-accent'
              : 'bg-zinc-800 text-zinc-500'
          )}
        >
          {post.signal === 'high' ? 'high signal' : 'low signal'}
        </Badge>
      )}
      {post.connected_repos && (
        <span className="text-[11px] text-zinc-500 font-mono">
          {post.connected_repos.full_name}
          {commitHash && <span className="text-zinc-600"> @ {commitHash}</span>}
        </span>
      )}
    </div>
  )
}

/** Bottom-row metadata: char count, age, view post link, platform badges */
export function PostCardMeta({
  post,
  charCount,
  charLimit = 280,
  overLimit,
  editing,
}: {
  post: Post
  charCount: number
  charLimit?: number
  overLimit: boolean
  editing: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      {!editing && (
        <span className={cn('text-[11px] font-mono', overLimit ? 'text-red-400' : 'text-zinc-500')}>
          {charCount}/{charLimit}
        </span>
      )}
      <span
        className={cn(
          'text-[11px] font-mono',
          post.status === 'draft'
            ? {
                fresh: 'text-zinc-500',
                aging: 'text-amber-400/70',
                stale: 'text-red-400/70',
              }[draftAgeBucket(post.created_at)]
            : 'text-zinc-500'
        )}
      >
        {post.status === 'draft' ? draftAgeText(post.created_at) : timeAgo(post.created_at)}
      </span>
      {post.status === 'published' && post.platforms && post.platforms.length > 0 && (
        <div className="flex items-center gap-1.5">
          {post.platforms.map((p) => (
            <Badge
              key={p}
              variant="secondary"
              className={cn(
                'text-[10px] border-0',
                platformConfig[p]?.color ?? 'bg-zinc-800 text-zinc-400'
              )}
            >
              {platformConfig[p]?.label ?? p}
            </Badge>
          ))}
        </div>
      )}
      {post.status === 'published' && post.platform_post_url && (
        <a
          href={post.platform_post_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          View post
        </a>
      )}
    </div>
  )
}
