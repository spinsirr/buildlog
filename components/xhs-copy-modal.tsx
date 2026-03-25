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

export function XhsCopyModal({
  open,
  onOpenChange,
  content,
  loading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  content: string
  loading: boolean
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    toast.success('已复制到剪贴板')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-50 flex items-center gap-2">
            <span className="text-base">📕</span>
            小红书文案
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
            <span className="text-sm text-zinc-500">生成中...</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 max-h-80 overflow-y-auto">
              <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{content}</p>
            </div>
            <p className="text-[11px] text-zinc-600">复制后打开小红书 App 粘贴发布</p>
          </div>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-zinc-400 text-xs font-medium hover:text-zinc-200 transition-colors"
          >
            关闭
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={loading || !content}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-500 disabled:opacity-50 transition-colors"
          >
            {copied ? <Check className="h-3 w-3" /> : <ClipboardCopy className="h-3 w-3" />}
            {copied ? '已复制' : '复制文案'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
