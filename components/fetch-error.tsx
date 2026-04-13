'use client'

export function FetchError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-lg bg-zinc-900 border border-zinc-800">
      <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
        <span className="text-red-400 text-lg">!</span>
      </div>
      <p className="text-sm text-zinc-200">Failed to load data</p>
      <p className="text-xs text-zinc-500">Check your connection and try again.</p>
      <button
        type="button"
        onClick={onRetry}
        className="px-4 py-2 text-sm rounded-md bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
