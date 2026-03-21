'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export interface Profile {
  github_username: string | null
  github_avatar_url: string | null
}

async function fetchProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('github_username, github_avatar_url')
    .eq('id', user.id)
    .single()
  return data
}

export function useProfile() {
  return useSWR<Profile | null>('profile', fetchProfile, {
    dedupingInterval: 60000,
  })
}
