'use client'

import { Crown, Loader2, Pencil, RefreshCw, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { platformConfig } from '@/lib/platforms'
import type { Post } from '@/lib/types'

export function PostCardPrimaryActions({
  post,
  editing,
  busy,
  regenerating,
  overLimit,
  connectedPlatforms,
  onEdit,
  onRegenerate,
  onPublish,
  onDelete,
}: {
  post: Post
  editing: boolean
  busy: boolean
  regenerating: boolean
  overLimit: boolean
  connectedPlatforms: string[]
  onEdit: () => void
  onRegenerate: () => void
  onPublish: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-mono-ui uppercase tracking-[0.18em] text-zinc-500">
            Draft Actions
          </p>
          <p className="text-xs text-zinc-400">
            Refresh the source draft, edit the copy, or send this version to publish.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {post.status === 'draft' && post.source_type !== 'manual' && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerate}
              disabled={regenerating || busy}
              className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-amber-300"
            >
              {regenerating ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
              )}
              Refresh draft
            </Button>
          )}

          {!editing && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              disabled={busy}
              className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            >
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Edit
            </Button>
          )}

          {post.status === 'draft' && (
            <Button
              variant="outline"
              size="sm"
              onClick={onPublish}
              disabled={busy || overLimit}
              className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-neo-accent"
              aria-label={
                overLimit
                  ? 'Post exceeds character limit'
                  : connectedPlatforms.length === 0
                    ? 'No platforms connected'
                    : `Publish to ${connectedPlatforms.map((p) => platformConfig[p]?.label ?? p).join(' + ')}`
              }
            >
              {busy ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-2 h-3.5 w-3.5" />
              )}
              Publish
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            disabled={busy}
            className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-red-300"
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}

export function PostCardPreviewActions({
  post,
  plan = 'free',
  onOpenVariants,
}: {
  post: Post
  plan?: 'free' | 'pro'
  onOpenVariants: () => void
}) {
  if (post.status !== 'draft') return null

  const isPro = plan === 'pro'

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-mono-ui uppercase tracking-[0.18em] text-zinc-500">
            Premium Feature
          </p>
          <p className="text-xs text-zinc-400">
            The base draft is short-form by default. Premium unlocks platform-specific rewrites.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenVariants}
            className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-amber-300"
          >
            <Crown className="mr-2 h-3.5 w-3.5" />
            {isPro ? 'Open variants' : 'Premium variants'}
          </Button>
        </div>
      </div>
    </div>
  )
}
