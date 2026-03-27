'use client'

import {
  Check,
  ExternalLink,
  Eye,
  Loader2,
  Pencil,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PostPreviewModal } from '@/components/post-preview-modal'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { XhsCopyModal } from '@/components/xhs-copy-modal'
import { platformConfig } from '@/lib/platforms'
import type { Post } from '@/lib/types'
import { cn } from '@/lib/utils'

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

  const commitHash =
    post.source_data && typeof post.source_data === 'object' && 'url' in post.source_data
      ? (post.source_data.url as string)?.split('/').pop()?.slice(0, 7)
      : null

  const charCount = (editing ? editContent : post.content).length
  const overLimit = charCount > 280

  async function handleSave() {
    setBusy(true)
    await onUpdate(post.id, { content: editContent })
    setEditing(false)
    setBusy(false)
  }

  async function handleConfirmPublish() {
    setBusy(true)
    try {
      await onUpdate(post.id, { status: 'published' })
      setShowPreview(false)
      toast.success('Post published', {
        description: connectedPlatforms.map((p) => platformConfig[p]?.label ?? p).join(', '),
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish')
    }
    setBusy(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this post?')) return
    setBusy(true)
    await onDelete(post.id)
    toast.success('Post deleted')
    setBusy(false)
  }

  async function handleRegenerate() {
    setRegenerating(true)
    try {
      await onRegenerate(post.id)
      toast.success('Post regenerated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to regenerate')
    }
    setRegenerating(false)
  }

  async function handleGenerateXhs() {
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
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors">
      <CardContent className="pt-5 space-y-4">
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md p-3 text-sm text-zinc-200 resize-none focus:outline-none focus:border-zinc-500"
              rows={4}
              aria-label="Edit post content"
            />
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-700 text-zinc-200 text-xs font-medium hover:bg-zinc-600 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false)
                    setEditContent(post.content)
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-zinc-400 text-xs font-medium hover:text-zinc-200"
                >
                  <X className="h-3 w-3" />
                  Cancel
                </button>
              </div>
              <span
                className={cn(
                  'text-[11px] font-mono',
                  overLimit ? 'text-red-400' : 'text-zinc-600'
                )}
              >
                {charCount}/280
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {post.content}
          </p>
        )}

        {post.status === 'published' && (
          <div className="flex items-center gap-3">
            {post.platform_post_url && (
              <a
                href={post.platform_post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
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
                      platformConfig[p]?.color ?? 'bg-zinc-800 text-zinc-500'
                    )}
                  >
                    {platformConfig[p]?.label ?? p}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        <Separator className="bg-zinc-800" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge
              variant="secondary"
              className={cn(
                'text-[10px] border-0',
                post.status === 'published'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : post.status === 'draft'
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-zinc-800 text-zinc-500'
              )}
            >
              {post.status}
            </Badge>
            <Badge variant="secondary" className="text-[10px] border-0 bg-zinc-800 text-zinc-500">
              {post.source_type}
            </Badge>
            {post.connected_repos && (
              <span className="text-[11px] text-zinc-600 font-mono">
                {post.connected_repos.full_name}
                {commitHash && <span className="text-zinc-700"> @ {commitHash}</span>}
              </span>
            )}
            {!editing && (
              <span
                className={cn(
                  'text-[11px] font-mono',
                  overLimit ? 'text-red-400' : 'text-zinc-600'
                )}
              >
                {charCount}/280
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {post.status === 'draft' && post.source_type !== 'manual' && (
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={regenerating || busy}
                className="p-2.5 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-md text-zinc-500 hover:text-amber-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                aria-label="Regenerate with AI"
              >
                {regenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </button>
            )}
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                disabled={busy}
                className="p-2.5 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                aria-label="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {post.status === 'draft' && (
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                disabled={busy}
                className="p-2.5 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-md text-zinc-500 hover:text-sky-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                aria-label="Preview post"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
            )}
            {post.status === 'draft' && (
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                disabled={busy || overLimit}
                className="p-2.5 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-md text-zinc-500 hover:text-indigo-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                aria-label={
                  overLimit
                    ? 'Post exceeds 280 characters'
                    : connectedPlatforms.length === 0
                      ? 'No platforms connected'
                      : `Publish to ${connectedPlatforms.map((p) => platformConfig[p]?.label ?? p).join(' + ')}`
                }
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            )}
            {post.source_type !== 'manual' && (
              <button
                type="button"
                onClick={handleGenerateXhs}
                disabled={busy || xhsLoading}
                className="p-2.5 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                aria-label="生成小红书文案"
              >
                {xhsLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="p-2.5 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
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
