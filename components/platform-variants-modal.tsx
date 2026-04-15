'use client'

import { Crown, Linkedin, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function PlatformVariantsModal({
  open,
  onOpenChange,
  isPro,
  linkedInLoading,
  xhsLoading,
  onGenerateLinkedIn,
  onGenerateXhs,
  onUpgrade,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  isPro: boolean
  linkedInLoading: boolean
  xhsLoading: boolean
  onGenerateLinkedIn: () => void
  onGenerateXhs: () => void
  onUpgrade: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-50 flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-400" />
            Premium Variants
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            The base draft stays available for every connected platform. Premium variants are
            optional platform-specific rewrites you can generate, preview, and choose instead of the
            default version.
          </p>

          <div className="grid gap-3">
            <button
              type="button"
              onClick={isPro ? onGenerateLinkedIn : onUpgrade}
              className="flex items-start justify-between rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-left transition-colors hover:bg-zinc-900"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-zinc-100">
                  <Linkedin className="h-4 w-4 text-blue-400" />
                  <span className="font-medium">LinkedIn long-form</span>
                </div>
                <p className="text-xs text-zinc-400">
                  Hook-first, longer, more reflective version for professional audiences, with its
                  own dedicated preview.
                </p>
              </div>
              <span className="text-xs text-zinc-500">
                {linkedInLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isPro ? (
                  'Generate + preview'
                ) : (
                  'Upgrade'
                )}
              </span>
            </button>

            <button
              type="button"
              onClick={isPro ? onGenerateXhs : onUpgrade}
              className="flex items-start justify-between rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-left transition-colors hover:bg-zinc-900"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-zinc-100">
                  <Sparkles className="h-4 w-4 text-red-400" />
                  <span className="font-medium">Xiaohongshu rewrite</span>
                </div>
                <p className="text-xs text-zinc-400">
                  More narrative and creator-style version tuned for Xiaohongshu format, with its
                  own dedicated preview.
                </p>
              </div>
              <span className="text-xs text-zinc-500">
                {xhsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isPro ? (
                  'Generate + preview'
                ) : (
                  'Upgrade'
                )}
              </span>
            </button>
          </div>

          {!isPro && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              Upgrade to Pro to unlock optional platform-specific versions like LinkedIn and
              Xiaohongshu. You can still publish the default short-form version anywhere.
            </div>
          )}
        </div>

        <DialogFooter className="bg-zinc-900 border-zinc-800">
          {!isPro && (
            <Button
              onClick={onUpgrade}
              className="bg-neo-accent hover:bg-neo-accent/90 text-white border-2 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(255,255,255,0.1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            >
              Upgrade to Pro
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
