'use client'

import { memo, useCallback, useState } from 'react'
import { toast } from 'sonner'
import { PostDetailModal } from '@/components/post-detail-modal'
import { PostPreviewModal } from '@/components/post-preview-modal'
import { Card, CardContent } from '@/components/ui/card'
import { platformConfig } from '@/lib/platforms'
import type { Post } from '@/lib/types'
import { PostCardActions } from './post-card-actions'
import { PostCardBadges, PostCardMeta } from './post-card-header'

// Memoized so that parent re-renders (search typing, tab switches, sibling
// state changes) don't cascade into every card in the list. Props are a mix
// of primitives, stable handler refs (see `useCallback` in posts-client), and
// the `post` object whose identity is stable across SWR dedupes.
export const PostCard = memo(function PostCard({
  post,
  onUpdate,
  onDelete,
  onRegenerate,
  onGenerateVariant,
  onSaveDetails,
  onSchedule,
  connectedPlatforms,
  charLimit = 280,
  xPremium,
}: {
  post: Post
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onRegenerate: (id: string) => Promise<void>
  onGenerateVariant: (id: string, platform: string) => Promise<Post>
  onSaveDetails: (
    id: string,
    updates: { content?: string; platform_variants?: Record<string, string> }
  ) => Promise<void>
  onSchedule?: (id: string, scheduledAt: string | null) => Promise<void>
  connectedPlatforms: string[]
  charLimit?: number
  xPremium: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const charCount = post.content.length
  const overLimit = charCount > charLimit

  const handleConfirmPublish = useCallback(async () => {
    setBusy(true)
    const previousStatus = post.status
    try {
      await onUpdate(post.id, { status: 'published' })
      setShowPreview(false)
      toast.success('Published! 🎉', {
        description: `Live on ${connectedPlatforms.map((p) => platformConfig[p]?.label ?? p).join(', ')}`,
        duration: 4000,
      })
    } catch (err) {
      // Revert optimistic UI state on error
      await onUpdate(post.id, { status: previousStatus }).catch(() => {})
      toast.error(err instanceof Error ? err.message : 'Failed to publish')
    }
    setBusy(false)
  }, [onUpdate, post.id, post.status, connectedPlatforms])

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

  const handleOpenDetails = useCallback(() => {
    setShowDetails(true)
  }, [])

  const handleShowPreview = useCallback(() => {
    setShowPreview(true)
  }, [])

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
            overLimit={overLimit}
            editing={false}
          />

          <PostCardActions
            post={post}
            editing={false}
            busy={busy}
            regenerating={regenerating}
            overLimit={overLimit}
            connectedPlatforms={connectedPlatforms}
            onEdit={handleOpenDetails}
            onRegenerate={handleRegenerate}
            onShowPreview={handleShowPreview}
            onDelete={handleDelete}
          />
        </div>
      </CardContent>

      <PostPreviewModal
        content={post.content}
        open={showPreview}
        onOpenChange={setShowPreview}
        onConfirmPublish={handleConfirmPublish}
        busy={busy}
        connectedPlatforms={connectedPlatforms}
        charLimit={charLimit}
      />

      <PostDetailModal
        post={post}
        open={showDetails}
        onOpenChange={setShowDetails}
        connectedPlatforms={connectedPlatforms}
        xPremium={xPremium}
        onGenerateVariant={onGenerateVariant}
        onSave={onSaveDetails}
      />
    </Card>
  )
})
