'use client'

import { AtSign, Hash, Loader2, Send } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { platformConfig } from '@/lib/platforms'
import { cn } from '@/lib/utils'

function renderPreviewContent(content: string) {
  return content.split(/(\s)/).map((word, i) => {
    if (word.match(/^#\w+/)) {
      return (
        <span key={i} className="text-sky-400">
          {word}
        </span>
      )
    }
    if (word.match(/^@\w+/)) {
      return (
        <span key={i} className="text-sky-400">
          {word}
        </span>
      )
    }
    if (word.match(/^https?:\/\//)) {
      return (
        <span key={i} className="text-sky-400 underline">
          {word.length > 23 ? `${word.slice(0, 23)}...` : word}
        </span>
      )
    }
    return word
  })
}

export function PostPreviewModal({
  content,
  open,
  onOpenChange,
  onConfirmPublish,
  busy,
  connectedPlatforms,
  charLimit = 280,
  publishBlocked,
}: {
  content: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirmPublish: () => void
  busy: boolean
  connectedPlatforms: string[]
  charLimit?: number
  /**
   * True when at least one platform's effective content (variant or default)
   * exceeds that platform's own character limit. Parent computes this across
   * all connected platforms — the preview modal only sees default content.
   */
  publishBlocked?: boolean
}) {
  const charCount = content.length
  const defaultOver = charCount > charLimit
  const overLimit = publishBlocked ?? defaultOver
  const remaining = charLimit - charCount

  const pct = Math.min(charCount / charLimit, 1)
  const radius = 10
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - pct)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-50">Post Preview</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-zinc-800" />
            <div>
              <div className="text-sm font-semibold text-zinc-200">You</div>
              <div className="text-xs text-zinc-500">@your_handle</div>
            </div>
          </div>
          <p className="text-[15px] text-zinc-200 leading-relaxed whitespace-pre-wrap">
            {renderPreviewContent(content)}
          </p>
          <div className="text-xs text-zinc-500">
            {new Date().toLocaleDateString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Hash className="h-3 w-3 text-zinc-500" />
              <span className="text-xs text-zinc-500">
                {(content.match(/#\w+/g) || []).length} hashtags
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <AtSign className="h-3 w-3 text-zinc-500" />
              <span className="text-xs text-zinc-500">
                {(content.match(/@\w+/g) || []).length} mentions
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {remaining <= 20 && (
              <span
                className={cn(
                  'text-xs font-mono',
                  overLimit ? 'text-red-400' : remaining <= 0 ? 'text-red-400' : 'text-amber-400'
                )}
              >
                {remaining}
              </span>
            )}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              className="-rotate-90"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r={radius}
                fill="none"
                className="stroke-zinc-700"
                strokeWidth="2"
              />
              <circle
                cx="12"
                cy="12"
                r={radius}
                fill="none"
                className={cn(
                  overLimit
                    ? 'stroke-red-400'
                    : remaining <= 20
                      ? 'stroke-amber-400'
                      : 'stroke-neo-accent'
                )}
                strokeWidth="2"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {overLimit && (
          <div className="text-xs text-red-400 bg-red-500/10 rounded-md px-3 py-2">
            {defaultOver
              ? `Default content exceeds the ${charLimit} character limit by ${charCount - charLimit} characters. Edit before publishing.`
              : 'A platform variant exceeds its character limit. Open Edit to fix it before publishing.'}
          </div>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-zinc-400 text-xs font-medium hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirmPublish}
            disabled={busy || overLimit || connectedPlatforms.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-none border-2 border-black bg-neo-accent text-white text-xs font-bold font-mono-ui uppercase tracking-wider hover:bg-neo-accent/90 shadow-[2px_2px_0px_0px_rgba(255,255,255,0.1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50 transition-colors"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            {connectedPlatforms.length === 0
              ? 'No platforms connected'
              : `Publish to ${connectedPlatforms.map((p) => platformConfig[p]?.label ?? p).join(' + ')}`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
