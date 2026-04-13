'use client'

import { Eye, Loader2, Pencil, RefreshCw, Send, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { platformConfig } from '@/lib/platforms'
import type { Post } from '@/lib/types'

export function PostCardActions({
  post,
  editing,
  busy,
  regenerating,
  xhsLoading,
  overLimit,
  connectedPlatforms,
  onEdit,
  onRegenerate,
  onShowPreview,
  onGenerateXhs,
  onDelete,
}: {
  post: Post
  editing: boolean
  busy: boolean
  regenerating: boolean
  xhsLoading: boolean
  overLimit: boolean
  connectedPlatforms: string[]
  onEdit: () => void
  onRegenerate: () => void
  onShowPreview: () => void
  onGenerateXhs: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-0.5">
      {post.status === 'draft' && post.source_type !== 'manual' && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRegenerate}
          disabled={regenerating || busy}
          className="min-h-[44px] min-w-[44px] text-zinc-400 hover:text-amber-400 disabled:cursor-not-allowed"
          aria-label="Regenerate with AI"
        >
          {regenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
      {!editing && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          disabled={busy}
          className="min-h-[44px] min-w-[44px] disabled:cursor-not-allowed"
          aria-label="Edit post"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
      {post.status === 'draft' && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onShowPreview}
          disabled={busy}
          className="min-h-[44px] min-w-[44px] text-zinc-400 hover:text-sky-400 disabled:cursor-not-allowed"
          aria-label="Preview post"
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
      )}
      {post.status === 'draft' && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onShowPreview}
          disabled={busy || overLimit}
          className="min-h-[44px] min-w-[44px] text-zinc-400 hover:text-neo-accent disabled:cursor-not-allowed"
          aria-label={
            overLimit
              ? 'Post exceeds character limit'
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
        </Button>
      )}
      {post.source_type !== 'manual' && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onGenerateXhs}
          disabled={busy || xhsLoading}
          className="min-h-[44px] min-w-[44px] text-zinc-400 hover:text-red-400 disabled:cursor-not-allowed"
          aria-label="生成小红书文案"
        >
          {xhsLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        disabled={busy}
        className="min-h-[44px] min-w-[44px] text-zinc-400 hover:text-red-400 disabled:cursor-not-allowed"
        aria-label="Delete post"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
