'use client'

import { Flame } from 'lucide-react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

async function fetchStreak() {
  const { data } = await supabase
    .from('posts')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  const streakPosts = data as { created_at: string }[] | null

  let streak = 0
  if (streakPosts && streakPosts.length > 0) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const postDays = new Set(
      streakPosts.map((p) => {
        const d = new Date(p.created_at)
        d.setHours(0, 0, 0, 0)
        return d.getTime()
      })
    )
    const dayMs = 86400000
    let checkDate = today.getTime()
    if (!postDays.has(checkDate)) checkDate = today.getTime() - dayMs
    while (postDays.has(checkDate)) {
      streak++
      checkDate -= dayMs
    }
  }
  return streak
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
