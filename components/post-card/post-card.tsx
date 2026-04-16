'use client'

import { memo, useCallback, useState } from 'react'
import { toast } from 'sonner'
import { LinkedInCopyModal } from '@/components/linkedin-copy-modal'
import { PostPreviewModal } from '@/components/post-preview-modal'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { XhsCopyModal, type XhsLang } from '@/components/xhs-copy-modal'
import { platformConfig } from '@/lib/platforms'
import type { Post } from '@/lib/types'
import { PostCardActions } from './post-card-actions'
import { PostCardEditor } from './post-card-editor'
import { PostCardHeader, PostCardMeta } from './post-card-header'

// Memoized so that parent re-renders (search typing, tab switches, sibling
// state changes) don't cascade into every card in the list. Props are a mix
// of primitives, stable handler refs (see `useCallback` in posts-client), and
// the `post` object whose identity is stable across SWR dedupes.
export const PostCard = memo(function PostCard({
  post,
  onUpdate,
  onDelete,
  onRegenerate,
  onGenerateXhs,
  onGenerateLinkedIn,
  onSchedule,
  connectedPlatforms,
  charLimit = 280,
}: {
  post: Post
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onRegenerate: (id: string) => Promise<void>
  onGenerateXhs: (id: string, lang: XhsLang) => Promise<string>
  onGenerateLinkedIn: (id: string) => Promise<string>
  onSchedule?: (id: string, scheduledAt: string | null) => Promise<void>
  connectedPlatforms: string[]
  charLimit?: number
}) {
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(post.content)
  const [busy, setBusy] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showXhs, setShowXhs] = useState(false)
  const [xhsContent, setXhsContent] = useState<string | null>(null)
  const [xhsLoading, setXhsLoading] = useState(false)
  const [xhsLang, setXhsLang] = useState<XhsLang | null>(null)
  const [showLinkedIn, setShowLinkedIn] = useState(false)
  const [linkedInContent, setLinkedInContent] = useState<string | null>(null)
  const [linkedInLoading, setLinkedInLoading] = useState(false)

  const charCount = (editing ? editContent : post.content).length
  const overLimit = charCount > charLimit

  const handleSave = useCallback(async () => {
    setBusy(true)
    try {
      await onUpdate(post.id, { content: editContent })
      setEditing(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    }
    setBusy(false)
  }, [onUpdate, post.id, editContent])

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

  // Opening the modal only shows the language picker — generation happens
  // after the user picks en/zh so we don't commit tokens until they choose.
  const handleOpenXhs = useCallback(() => {
    setXhsContent(null)
    setXhsLang(null)
    setShowXhs(true)
  }, [])

  const handleXhsGenerate = useCallback(
    async (lang: XhsLang) => {
      setXhsLang(lang)
      setXhsLoading(true)
      try {
        const content = await onGenerateXhs(post.id, lang)
        setXhsContent(content)
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : lang === 'zh' ? '生成失败' : 'Generation failed'
        )
        setShowXhs(false)
      }
      setXhsLoading(false)
    },
    [onGenerateXhs, post.id]
  )

  const handleXhsOpenChange = useCallback((open: boolean) => {
    setShowXhs(open)
    if (!open) {
      setXhsContent(null)
      setXhsLang(null)
      setXhsLoading(false)
    }
  }, [])

  const handleOpenLinkedIn = useCallback(() => {
    setLinkedInContent(null)
    setShowLinkedIn(true)
  }, [])

  const handleLinkedInGenerate = useCallback(async () => {
    setLinkedInLoading(true)
    try {
      const content = await onGenerateLinkedIn(post.id)
      setLinkedInContent(content)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
      setShowLinkedIn(false)
    }
    setLinkedInLoading(false)
  }, [onGenerateLinkedIn, post.id])

  const handleLinkedInOpenChange = useCallback((open: boolean) => {
    setShowLinkedIn(open)
    if (!open) {
      setLinkedInContent(null)
      setLinkedInLoading(false)
    }
  }, [])

  const handleEdit = useCallback(() => {
    setEditContent(post.content)
    setEditing(true)
  }, [post.content])

  const handleCancelEdit = useCallback(() => {
    setEditing(false)
    setEditContent(post.content)
  }, [post.content])

  const handleShowPreview = useCallback(() => {
    setShowPreview(true)
  }, [])

  return (
    <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors">
      <CardContent className="pt-4 space-y-4">
        {editing ? (
          <PostCardEditor
            editContent={editContent}
            onEditContentChange={setEditContent}
            charCount={charCount}
            charLimit={charLimit}
            overLimit={overLimit}
            busy={busy}
            onSave={handleSave}
            onCancel={handleCancelEdit}
          />
        ) : (
          <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {post.content}
          </p>
        )}

        <PostCardHeader
          post={post}
          charCount={charCount}
          charLimit={charLimit}
          overLimit={overLimit}
          editing={editing}
        />

        <Separator className="bg-zinc-800" />

        <div className="flex items-center justify-between">
          <PostCardMeta
            post={post}
            charCount={charCount}
            charLimit={charLimit}
            overLimit={overLimit}
            editing={editing}
          />

          <PostCardActions
            post={post}
            editing={editing}
            busy={busy}
            regenerating={regenerating}
            xhsLoading={xhsLoading}
            linkedInLoading={linkedInLoading}
            overLimit={overLimit}
            connectedPlatforms={connectedPlatforms}
            onEdit={handleEdit}
            onRegenerate={handleRegenerate}
            onShowPreview={handleShowPreview}
            onGenerateXhs={handleOpenXhs}
            onGenerateLinkedIn={handleOpenLinkedIn}
            onDelete={handleDelete}
          />
        </div>
      </CardContent>

      <PostPreviewModal
        content={editing ? editContent : post.content}
        open={showPreview}
        onOpenChange={setShowPreview}
        onConfirmPublish={handleConfirmPublish}
        busy={busy}
        connectedPlatforms={connectedPlatforms}
        charLimit={charLimit}
      />

      <XhsCopyModal
        open={showXhs}
        onOpenChange={handleXhsOpenChange}
        content={xhsContent}
        loading={xhsLoading}
        lang={xhsLang}
        onGenerate={handleXhsGenerate}
      />

      <LinkedInCopyModal
        open={showLinkedIn}
        onOpenChange={handleLinkedInOpenChange}
        content={linkedInContent}
        loading={linkedInLoading}
        onGenerate={handleLinkedInGenerate}
      />
    </Card>
  )
})
