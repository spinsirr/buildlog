'use client'

import { Flame } from 'lucide-react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { calculateStreak } from '@/lib/utils'

async function fetchStreak() {
  const supabase = createClient()
  const { data } = await supabase
    .from('posts')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  return calculateStreak((data as { created_at: string }[]) ?? [])
}

export function StreakCounter() {
  const { data: streak } = useSWR<number>('streak', fetchStreak, {
    dedupingInterval: 60000,
  })

  return (
    <div className="px-3 pb-3">
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-zinc-900 border border-zinc-800">
        <Flame className="h-4 w-4 text-orange-400" />
        <span className="text-sm font-medium text-zinc-300">{streak ?? 0}</span>
        <span className="text-xs text-zinc-500">day streak</span>
      </div>
    </div>
  )
}
