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

export type XhsLang = 'en' | 'zh'

export function XhsCopyModal({
  open,
  onOpenChange,
  content,
  loading,
  lang,
  onGenerate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  content: string | null
  loading: boolean
  lang: XhsLang | null
  onGenerate: (lang: XhsLang) => void
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!content) return
    await navigator.clipboard.writeText(content)
    setCopied(true)
    toast.success(lang === 'zh' ? '已复制到剪贴板' : 'Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  // Pre-generation state: pick language
  const showLangPicker = !loading && !content

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-50 flex items-center gap-2">
            <span className="text-base">📕</span>
            XHS-style copy
          </DialogTitle>
        </DialogHeader>

        {showLangPicker ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-zinc-400">
              Pick a language to generate and preview an XHS-style version. The default short-form
              draft is still available if you want to post that instead.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onGenerate('en')}
                className="flex flex-col items-center gap-1 border-2 border-zinc-700 hover:border-neo-accent bg-zinc-950 hover:bg-neo-accent/5 px-4 py-5 transition-colors"
              >
                <span className="text-2xl">🇬🇧</span>
                <span className="font-display font-bold text-zinc-100">English</span>
                <span className="font-mono-ui text-[11px] uppercase tracking-widest text-zinc-500">
                  XHS-style preview
                </span>
              </button>
              <button
                type="button"
                onClick={() => onGenerate('zh')}
                className="flex flex-col items-center gap-1 border-2 border-zinc-700 hover:border-neo-accent bg-zinc-950 hover:bg-neo-accent/5 px-4 py-5 transition-colors"
              >
                <span className="text-2xl">🇨🇳</span>
                <span className="font-display font-bold text-zinc-100">中文</span>
                <span className="font-mono-ui text-[11px] uppercase tracking-widest text-zinc-500">
                  小红书预览
                </span>
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12 gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
            <span className="text-sm text-zinc-500">
              {lang === 'zh' ? '生成中...' : 'Generating...'}
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="border-2 border-zinc-800 bg-zinc-950 p-4 max-h-80 overflow-y-auto">
              <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{content}</p>
            </div>
            <p className="text-[11px] text-zinc-600">
              {lang === 'zh'
                ? '这是小红书版本预览，复制后打开小红书 App 粘贴发布。你也可以继续使用默认短文版本。'
                : 'This is the generated XHS-style preview. Copy and paste into your target platform, or keep using the default short-form version.'}
            </p>
          </div>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-zinc-400 text-xs font-bold font-mono-ui uppercase tracking-wider hover:text-zinc-200 transition-colors"
          >
            {lang === 'zh' ? '关闭' : 'Close'}
          </button>
          {!showLangPicker && (
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
              {copied ? (lang === 'zh' ? '已复制' : 'Copied') : lang === 'zh' ? '复制文案' : 'Copy'}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
