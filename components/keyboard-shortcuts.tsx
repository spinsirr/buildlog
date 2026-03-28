'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

/** Global keyboard shortcuts for ADHD-friendly quick actions */
export function KeyboardShortcuts() {
  const router = useRouter()
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore when typing in inputs/textareas
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.target as HTMLElement)?.isContentEditable) return

      const mod = e.metaKey || e.ctrlKey

      if (mod && e.key === 'n') {
        e.preventDefault()
        router.push('/posts?new=1')
      } else if (mod && e.key === 'k') {
        e.preventDefault()
        router.push('/posts?focus=search')
      } else if (e.key === '?') {
        e.preventDefault()
        setShowHelp((v) => !v)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [router])

  if (!showHelp) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => setShowHelp(false)}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-label="Keyboard shortcuts"
        className="relative z-10 w-80 rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
      >
        <h2 className="text-sm font-semibold text-zinc-100 mb-4">Keyboard Shortcuts</h2>
        <div className="space-y-3">
          {[
            { keys: '⌘ N', label: 'New post' },
            { keys: '⌘ K', label: 'Search posts' },
            { keys: '?', label: 'Toggle this help' },
          ].map((s) => (
            <div key={s.keys} className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">{s.label}</span>
              <kbd className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-300">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowHelp(false)}
          className="mt-4 w-full text-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Press ? or Esc to close
        </button>
      </div>
    </div>
  )
}
