'use client'

import { Eraser, Loader2, Save, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getContentLimit, platformConfig } from '@/lib/platforms'
import type { Post } from '@/lib/types'
import { cn } from '@/lib/utils'

const DEFAULT_TAB = 'default'

type SaveUpdates = {
  content?: string
  platform_variants?: Record<string, string>
}

// Tabs show the user's connected publish platforms. An empty connectedPlatforms
// list means the user has nothing to target — the modal falls back to editing
// default content only.
export function PostDetailModal({
  post,
  open,
  onOpenChange,
  connectedPlatforms,
  xPremium,
  onGenerateVariant,
  onSave,
}: {
  post: Post
  open: boolean
  onOpenChange: (open: boolean) => void
  connectedPlatforms: string[]
  xPremium: boolean
  onGenerateVariant: (id: string, platform: string) => Promise<Post>
  onSave: (id: string, updates: SaveUpdates) => Promise<void>
}) {
  const [content, setContent] = useState(post.content)
  const [variants, setVariants] = useState<Record<string, string>>(post.platform_variants ?? {})
  const [activeTab, setActiveTab] = useState<string>(DEFAULT_TAB)
  const [generating, setGenerating] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [prevOpen, setPrevOpen] = useState(open)

  // Adjust state on open transition, per React's "adjusting state on prop
  // change" pattern (https://react.dev/reference/react/useState#storing-information-from-previous-renders).
  // Doing this in render (instead of useEffect) avoids a cascading re-render
  // when the modal first opens or reopens with a different post.
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setContent(post.content)
      setVariants(post.platform_variants ?? {})
      setActiveTab(DEFAULT_TAB)
    }
  }

  const defaultDirty = content !== post.content
  const variantsDirty = JSON.stringify(variants) !== JSON.stringify(post.platform_variants ?? {})
  const dirty = defaultDirty || variantsDirty

  const handleGenerate = async (platform: string) => {
    setGenerating(platform)
    try {
      // Persist dirty default content first so the server-side variant
      // generator riffs on the user's latest text, not the stale row.
      if (defaultDirty) {
        await onSave(post.id, { content })
      }
      const updated = await onGenerateVariant(post.id, platform)
      // Only merge the just-generated platform into local state. Preserves
      // any unsaved edits the user has made in other variant tabs.
      const serverVariant = updated.platform_variants?.[platform]
      if (typeof serverVariant === 'string') {
        setVariants((prev) => ({ ...prev, [platform]: serverVariant }))
      }
      // Default content may have just been persisted above; updated.content
      // reflects the source of truth either way.
      setContent(updated.content)
      toast.success(`${platformConfig[platform]?.label ?? platform} variant generated`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    }
    setGenerating(null)
  }

  const handleClear = (platform: string) => {
    setVariants((prev) => {
      if (!(platform in prev)) return prev
      const next = { ...prev }
      delete next[platform]
      return next
    })
  }

  const handleVariantChange = (platform: string, value: string) => {
    setVariants((prev) => ({ ...prev, [platform]: value }))
  }

  const handleSave = async () => {
    if (!dirty) {
      onOpenChange(false)
      return
    }
    setSaving(true)
    try {
      await onSave(post.id, {
        content: defaultDirty ? content : undefined,
        platform_variants: variantsDirty ? variants : undefined,
      })
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    }
    setSaving(false)
  }

  const defaultLimit = getContentLimit('twitter', xPremium)
  const defaultCount = content.length
  const defaultOver = defaultCount > defaultLimit
  // Saving an oversized variant would be accepted here but fail at publish
  // time when the platform rejects it. Block Save up front so the failure
  // mode is "fix it now" instead of "mystery publish error later".
  const anyVariantOver = Object.entries(variants).some(
    ([platform, text]) => text.length > getContentLimit(platform, xPremium)
  )
  const saveBlocked = defaultOver || anyVariantOver

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-50">Edit post</DialogTitle>
          <p className="text-xs text-zinc-500">
            Default content is used for platforms without a variant. Generate variants only for
            platforms that need platform-specific framing.
          </p>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v)}>
          <TabsList className="bg-zinc-950 border border-zinc-800 w-full justify-start overflow-x-auto">
            <TabsTrigger value={DEFAULT_TAB} className="data-[state=active]:bg-zinc-800">
              Default
            </TabsTrigger>
            {connectedPlatforms.map((platform) => {
              const hasVariant = platform in variants
              const cfg = platformConfig[platform]
              return (
                <TabsTrigger
                  key={platform}
                  value={platform}
                  className="data-[state=active]:bg-zinc-800 gap-1.5"
                >
                  {cfg?.label ?? platform}
                  {hasVariant && (
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-neo-accent" />
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>

          <TabsContent value={DEFAULT_TAB} className="mt-4 space-y-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-3 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 resize-none font-mono-ui"
              placeholder="Post content..."
            />
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">Used when no platform variant is set.</span>
              <span className={cn('font-mono-ui', defaultOver ? 'text-red-400' : 'text-zinc-500')}>
                {defaultCount} / {defaultLimit}
              </span>
            </div>
          </TabsContent>

          {connectedPlatforms.map((platform) => {
            const limit = getContentLimit(platform, xPremium)
            const variantText = variants[platform] ?? ''
            const hasVariant = platform in variants
            const count = variantText.length
            const over = count > limit
            const isGenerating = generating === platform
            const cfg = platformConfig[platform]

            return (
              <TabsContent key={platform} value={platform} className="mt-4 space-y-3">
                {hasVariant ? (
                  <>
                    <textarea
                      value={variantText}
                      onChange={(e) => handleVariantChange(platform, e.target.value)}
                      rows={platform === 'linkedin' ? 12 : 6}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-3 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 resize-none font-mono-ui"
                    />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">
                        Sent to {cfg?.label ?? platform} when publishing.
                      </span>
                      <span className={cn('font-mono-ui', over ? 'text-red-400' : 'text-zinc-500')}>
                        {count} / {limit}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleGenerate(platform)}
                        disabled={isGenerating || saving}
                        className="text-zinc-400 hover:text-zinc-200"
                      >
                        {isGenerating ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        Regenerate
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleClear(platform)}
                        disabled={isGenerating || saving}
                        className="text-zinc-400 hover:text-red-400"
                      >
                        <Eraser className="h-3.5 w-3.5" />
                        Clear variant
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-950/40 p-6 text-center space-y-3">
                    <p className="text-sm text-zinc-400">
                      No {cfg?.label ?? platform} variant. Publishing will use the default content
                      (up to {limit} chars).
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleGenerate(platform)}
                      disabled={isGenerating || saving}
                      className="bg-neo-accent hover:bg-neo-accent/90 text-white"
                    >
                      {isGenerating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Generate variant for {cfg?.label ?? platform}
                    </Button>
                  </div>
                )}
              </TabsContent>
            )
          })}
        </Tabs>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving || generating !== null}
            className="text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || generating !== null || saveBlocked}
            className="bg-neo-accent hover:bg-neo-accent/90 text-white"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
