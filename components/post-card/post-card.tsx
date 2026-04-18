'use client'

import { memo, useCallback, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { anyPlatformOverLimit } from '@/lib/posts'
import type { Post } from '@/lib/types'
import { PostCardActions } from './post-card-actions'
import { PostCardBadges, PostCardMeta } from './post-card-header'

// Memoized so that parent re-renders (search typing, tab switches, sibling
// state changes) don't cascade into every card in the list. Props are a mix
// of primitives, stable handler refs (see `useCallback` in posts-client), and
// the `post` object whose identity is stable across SWR dedupes.
//
// Preview + detail modals are mounted ONCE at the parent level (posts-client),
// not per-card, because rendering N hidden Radix Dialog trees costs real time
// on every list re-render (JSON.stringify in PostDetailModal was the worst).
export const PostCard = memo(function PostCard({
  post,
  onDelete,
  onRegenerate,
  onOpenPreview,
  onOpenDetails,
  connectedPlatforms,
  charLimit = 280,
  xPremium,
}: {
  post: Post
  onDelete: (id: string) => Promise<void>
  onRegenerate: (id: string) => Promise<void>
  onOpenPreview: (post: Post) => void
  onOpenDetails: (post: Post) => void
  connectedPlatforms: string[]
  charLimit?: number
  xPremium: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const charCount = post.content.length
  // Publish is only blocked when a platform's effective content (variant or
  // default) exceeds that platform's own limit. A long default used by
  // LinkedIn doesn't block publish when Twitter has its own short variant.
  const publishBlocked = anyPlatformOverLimit(post, connectedPlatforms, xPremium)
  // Default-vs-min-limit is still useful for the meta row ballpark counter.
  const defaultOverMinLimit = charCount > charLimit

  const handleDelete = useCallback(async () => {
    if (!confirm('Delete this post?')) return
    setBusy(true)
    try {
      await onDelete(post.id)
      toast.success('Post deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
    setBusy(false)
  }, [onDelete, post.id])

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true)
    try {
      await onRegenerate(post.id)
      toast.success('Post regenerated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to regenerate')
    }
    setRegenerating(false)
  }, [onRegenerate, post.id])

  const handleOpenDetails = useCallback(() => onOpenDetails(post), [onOpenDetails, post])
  const handleOpenPreview = useCallback(() => onOpenPreview(post), [onOpenPreview, post])

  return (
    <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors">
      <CardContent className="pt-1 space-y-4">
        <PostCardBadges post={post} />

        <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{post.content}</p>

        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
          <PostCardMeta
            post={post}
            charCount={charCount}
            charLimit={charLimit}
            overLimit={defaultOverMinLimit}
            editing={false}
          />

          <PostCardActions
            post={post}
            editing={false}
            busy={busy}
            regenerating={regenerating}
            overLimit={publishBlocked}
            connectedPlatforms={connectedPlatforms}
            onEdit={handleOpenDetails}
            onRegenerate={handleRegenerate}
            onShowPreview={handleOpenPreview}
            onDelete={handleDelete}
          />
        </div>
      </CardContent>
    </Card>
  )
})
