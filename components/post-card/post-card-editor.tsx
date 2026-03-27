'use client'

import { Check, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function PostCardEditor({
  editContent,
  onEditContentChange,
  charCount,
  overLimit,
  busy,
  onSave,
  onCancel,
}: {
  editContent: string
  onEditContentChange: (value: string) => void
  charCount: number
  overLimit: boolean
  busy: boolean
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-2">
      <textarea
        value={editContent}
        onChange={(e) => onEditContentChange(e.target.value)}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-md p-3 text-sm text-zinc-200 resize-none focus:outline-none focus:border-zinc-500"
        rows={4}
        aria-label="Edit post content"
      />
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            size="xs"
            variant="secondary"
            onClick={onSave}
            disabled={busy}
            className="disabled:cursor-not-allowed"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Save
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={onCancel}
            className="disabled:cursor-not-allowed"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        </div>
        <span className={cn('text-[11px] font-mono', overLimit ? 'text-red-400' : 'text-zinc-500')}>
          {charCount}/280
        </span>
      </div>
    </div>
  )
}
