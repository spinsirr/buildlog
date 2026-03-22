'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

const supabase = createClient()

async function fetchProfile(): Promise<Profile> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { github_username: null, github_avatar_url: null }
  }
  const { data } = await supabase
    .from('profiles')
    .select('github_username, github_avatar_url')
    .eq('id', user.id)
    .single()
  return {
    github_username: data?.github_username ?? null,
    github_avatar_url: data?.github_avatar_url ?? null,
  }
}

export function useProfile() {
  return useSWR<Profile>('profile', fetchProfile, {
    dedupingInterval: 60000,
  })
}
