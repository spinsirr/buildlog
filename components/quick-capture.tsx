'use client'

import { Loader2, Zap } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { callEdgeFunction } from '@/lib/edge-function'

/** "Parking lot" — capture a quick idea as a draft without leaving the current page */
export function QuickCapture() {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = value.trim()
    if (!text || busy) return

    setBusy(true)
    const result = await callEdgeFunction<{ error?: string }>('create-post', {
      body: { content: text },
    })

    if (result.ok) {
      setValue('')
      toast.success('Idea captured', { description: 'Saved as draft' })
    } else {
      toast.error('Capture failed', { description: result.error || 'Try again' })
    }
    setBusy(false)
    inputRef.current?.focus()
  }

  return (
    <div className="px-3 pb-2">
      <form onSubmit={handleSubmit} className="relative">
        <Zap className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-600" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Quick idea..."
          aria-label="Capture a quick idea as a draft"
          disabled={busy}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-md pl-7 pr-8 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 disabled:opacity-50"
        />
        {busy && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500 animate-spin" />
        )}
      </form>
    </div>
  )
}
