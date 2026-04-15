'use client'

import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { platformConfig } from '@/lib/platforms'
import type { Post } from '@/lib/types'
import { cn, draftAgeBucket, draftAgeText, timeAgo } from '@/lib/utils'

export function PostCardHeader({
  post,
  charCount,
  charLimit,
  overLimit,
  editing,
  plan = 'free',
}: {
  post: Post
  charCount: number
  charLimit?: number
  overLimit: boolean
  editing: boolean
  plan?: 'free' | 'pro'
}) {
  return (
    <>
      {post.status === 'published' && (
        <div className="flex items-center gap-3">
          {post.platform_post_url && (
            <a
              href={post.platform_post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-neo-accent hover:text-neo-accent/80 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              View post
            </a>
          )}
          {post.platforms && post.platforms.length > 0 && (
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
        </div>
      )}
    </>
  )
}

/** Metadata row: status badge, source type, repo info, character count */
export function PostCardMeta({
  post,
  charCount,
  charLimit = 280,
  overLimit,
  editing,
  plan = 'free',
}: {
  post: Post
  charCount: number
  charLimit?: number
  overLimit: boolean
  editing: boolean
  plan?: 'free' | 'pro'
}) {
  const commitHash =
    post.source_data && typeof post.source_data === 'object' && 'url' in post.source_data
      ? (post.source_data.url as string)?.split('/').pop()?.slice(0, 7)
      : null

  return (
    <div className="flex items-center gap-3">
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
        {post.status === 'draft' ? 'unpublished' : post.status}
      </Badge>
      {post.status === 'draft' && (
        <Badge variant="secondary" className="text-[10px] border-0 bg-zinc-800 text-zinc-300">
          {plan === 'pro' ? 'short-form default' : 'short-form'}
        </Badge>
      )}
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
      {!editing && (
        <span className={cn('text-[11px] font-mono', overLimit ? 'text-red-400' : 'text-zinc-500')}>
          {charCount}/{charLimit}
        </span>
      )}
      {/* Time anchor — explicit age for ADHD time blindness */}
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
    </div>
  )
}
