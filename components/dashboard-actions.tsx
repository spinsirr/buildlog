'use client'

import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useSWRConfig } from 'swr'
import { createClient } from '@/lib/supabase/client'

export function DashboardActions({ postId }: { postId: string }) {
  const router = useRouter()
  const { mutate } = useSWRConfig()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm('Delete this post?')) return
    setDeleting(true)
    try {
      const supabase = createClient()
      await supabase.from('posts').delete().eq('id', postId)
      await mutate(
        (key: unknown) =>
          Array.isArray(key) && (key[0] === 'posts-data' || key[0] === 'dashboard-data')
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => router.push(`/posts?edit=${postId}`)}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo-accent focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        aria-label="Edit post"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo-accent focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        aria-label="Delete post"
      >
        {deleting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  )
}
