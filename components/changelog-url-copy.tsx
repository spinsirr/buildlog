'use client'

import { Check, Copy, ExternalLink } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'

export function ChangelogUrlCopy({ username }: { username: string }) {
  const [copied, setCopied] = useState(false)
  const url = `https://buildlog.ink/changelog/${username}`

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [url])

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-md border border-zinc-800 bg-zinc-900/50 text-sm font-mono text-zinc-400 truncate">
        <span className="truncate">buildlog.ink/changelog/{username}</span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 shrink-0"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
      <a
        href={`/changelog/${username}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center justify-center h-7 rounded-[min(var(--radius-md),12px)] px-2.5 text-sm border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition-colors"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  )
}
