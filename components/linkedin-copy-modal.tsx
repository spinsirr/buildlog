'use client'

import { Check, ClipboardCopy, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export function LinkedInCopyModal({
  open,
  onOpenChange,
  content,
  loading,
  onGenerate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  content: string | null
  loading: boolean
  onGenerate: () => void
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!content) return
    await navigator.clipboard.writeText(content)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const showPrompt = !loading && !content

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-50 flex items-center gap-2">
            <span className="text-base">in</span>
            LinkedIn-optimised copy
          </DialogTitle>
        </DialogHeader>

        {showPrompt ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-zinc-400">
              Generate a longer-form, hook-first post optimised for the LinkedIn algorithm.
            </p>
            <button
              type="button"
              onClick={onGenerate}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-black bg-neo-accent text-white text-xs font-bold font-mono-ui uppercase tracking-wider',
                'hover:bg-neo-accent/90',
                'shadow-[2px_2px_0px_0px_rgba(255,255,255,0.1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none',
                'transition-colors'
              )}
            >
              Generate LinkedIn post
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12 gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
            <span className="text-sm text-zinc-500">Generating...</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="border-2 border-zinc-800 bg-zinc-950 p-4 max-h-80 overflow-y-auto">
              <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{content}</p>
            </div>
            <p className="text-[11px] text-zinc-600">
              Copy and paste into LinkedIn. No links in the post body for max reach.
            </p>
          </div>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-zinc-400 text-xs font-bold font-mono-ui uppercase tracking-wider hover:text-zinc-200 transition-colors"
          >
            Close
          </button>
          {!showPrompt && (
            <button
              type="button"
              onClick={handleCopy}
              disabled={loading || !content}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-1.5 border-2 border-black bg-neo-accent text-white text-xs font-bold font-mono-ui uppercase tracking-wider',
                'hover:bg-neo-accent/90 disabled:opacity-50',
                'shadow-[2px_2px_0px_0px_rgba(255,255,255,0.1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none',
                'transition-colors'
              )}
            >
              {copied ? <Check className="h-3 w-3" /> : <ClipboardCopy className="h-3 w-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
