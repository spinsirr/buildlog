'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { PostPreviewModal } from '@/components/post-preview-modal'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { XhsCopyModal } from '@/components/xhs-copy-modal'
import { platformConfig } from '@/lib/platforms'
import type { Post } from '@/lib/types'
import { PostCardActions } from './post-card-actions'
import { PostCardEditor } from './post-card-editor'
import { PostCardHeader, PostCardMeta } from './post-card-header'

export function PostCard({
  post,
  onUpdate,
  onDelete,
  onRegenerate,
  onGenerateXhs,
  connectedPlatforms,
}: {
  post: Post
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onRegenerate: (id: string) => Promise<void>
  onGenerateXhs: (id: string) => Promise<string>
  connectedPlatforms: string[]
}) {
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(post.content)
  const [busy, setBusy] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showXhs, setShowXhs] = useState(false)
  const [xhsContent, setXhsContent] = useState('')
  const [xhsLoading, setXhsLoading] = useState(false)

  const charCount = (editing ? editContent : post.content).length
  const overLimit = charCount > 280

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
      toast.success('Post published', {
        description: connectedPlatforms.map((p) => platformConfig[p]?.label ?? p).join(', '),
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

  const handleGenerateXhs = useCallback(async () => {
    setShowXhs(true)
    setXhsLoading(true)
    try {
      const content = await onGenerateXhs(post.id)
      setXhsContent(content)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '生成失败')
      setShowXhs(false)
    }
    setXhsLoading(false)
  }, [onGenerateXhs, post.id])

  const handleEdit = useCallback(() => {
    setEditing(true)
  }, [])

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

        <PostCardHeader post={post} charCount={charCount} overLimit={overLimit} editing={editing} />

        <Separator className="bg-zinc-800" />

        <div className="flex items-center justify-between">
          <PostCardMeta post={post} charCount={charCount} overLimit={overLimit} editing={editing} />

          <PostCardActions
            post={post}
            editing={editing}
            busy={busy}
            regenerating={regenerating}
            xhsLoading={xhsLoading}
            overLimit={overLimit}
            connectedPlatforms={connectedPlatforms}
            onEdit={handleEdit}
            onRegenerate={handleRegenerate}
            onShowPreview={handleShowPreview}
            onGenerateXhs={handleGenerateXhs}
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
      />

      <XhsCopyModal
        open={showXhs}
        onOpenChange={setShowXhs}
        content={xhsContent}
        loading={xhsLoading}
      />
    </Card>
  )
}
