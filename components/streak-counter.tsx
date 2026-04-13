'use client'

import { Flame } from 'lucide-react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { calculateStreak, cn } from '@/lib/utils'

async function fetchStreak() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 0
  const { data } = await supabase
    .from('posts')
    .select('created_at')
    .eq('user_id', user.id)
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
          'flex items-center gap-2 px-3 py-2.5 rounded-none border-2 transition-colors',
          fire
            ? 'bg-neo-accent/5 border-neo-accent/20'
            : hot
              ? 'bg-neo-secondary/5 border-neo-secondary/20'
              : 'bg-zinc-900 border-zinc-800'
        )}
      >
        <Flame
          className={cn(
            'h-4 w-4 transition-colors',
            fire ? 'text-neo-accent' : hot ? 'text-neo-secondary' : 'text-zinc-500'
          )}
        />
        <span
          className={cn(
            'text-sm font-bold font-mono-ui tabular-nums',
            fire ? 'text-neo-accent' : hot ? 'text-neo-secondary' : 'text-zinc-300'
          )}
        >
          {count}
        </span>
        <span className="text-xs text-zinc-500">day streak{fire ? ' 🔥' : ''}</span>
      </div>
    </div>
  )
}
