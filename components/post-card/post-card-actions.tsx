'use client'

import { Loader2, MoreHorizontal, Pencil, RefreshCw, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { platformConfig } from '@/lib/platforms'
import type { Post } from '@/lib/types'

export function PostCardActions({
  post,
  editing,
  busy,
  regenerating,
  overLimit,
  connectedPlatforms,
  onEdit,
  onRegenerate,
  onShowPreview,
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
  onShowPreview: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      {!editing && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          disabled={busy}
          className="h-7 w-7 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
          aria-label="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}

      {post.status === 'draft' && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onShowPreview}
          disabled={busy || overLimit}
          className="h-7 w-7 text-zinc-500 hover:text-neo-accent hover:bg-zinc-800"
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

      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
          disabled={busy}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 text-zinc-200">
          {post.status === 'draft' && post.source_type !== 'manual' && (
            <DropdownMenuItem
              onClick={onRegenerate}
              disabled={regenerating || busy}
              className="focus:bg-zinc-800"
            >
              {regenerating ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
              )}
              Regenerate draft
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="bg-zinc-800" />
          <DropdownMenuItem
            onClick={onDelete}
            className="focus:bg-zinc-800 text-red-400 focus:text-red-300"
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
