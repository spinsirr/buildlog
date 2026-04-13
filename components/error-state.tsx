'use client'

export function ErrorState({
  message = 'Something went wrong.',
  retry,
}: {
  message?: string
  retry: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
        <span className="text-red-400 text-lg">!</span>
      </div>
      <p className="text-sm text-zinc-400">{message}</p>
      <button
        type="button"
        onClick={retry}
        className="px-4 py-2 text-sm rounded-md bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo-accent focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        aria-label="Retry loading"
      >
        Try again
      </button>
    </div>
  )
}
