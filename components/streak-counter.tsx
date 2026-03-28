'use client'

import { Flame } from 'lucide-react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { calculateStreak, cn } from '@/lib/utils'

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

  const count = streak ?? 0
  const hot = count >= 3
  const fire = count >= 7

  return (
    <div className="px-3 pb-3">
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2.5 rounded-md border transition-colors',
          fire
            ? 'bg-orange-500/5 border-orange-500/20'
            : hot
              ? 'bg-amber-500/5 border-amber-500/20'
              : 'bg-zinc-900 border-zinc-800'
        )}
      >
        <Flame
          className={cn(
            'h-4 w-4 transition-colors',
            fire ? 'text-orange-400' : hot ? 'text-amber-400' : 'text-zinc-500'
          )}
        />
        <span
          className={cn(
            'text-sm font-medium tabular-nums',
            fire ? 'text-orange-300' : hot ? 'text-amber-300' : 'text-zinc-300'
          )}
        >
          {count}
        </span>
        <span className="text-xs text-zinc-500">day streak{fire ? ' 🔥' : ''}</span>
      </div>
    </div>
  )
}
