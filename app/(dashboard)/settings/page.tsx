'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { ErrorState } from '@/components/error-state'
import { SettingsClient } from '@/components/settings-client'
import { createClient } from '@/lib/supabase/client'
import { SettingsSkeleton } from './loading'

function useSettingsData() {
  const supabase = useMemo(() => createClient(), [])
  return useSWR('settings-data', async () => {
    const [{ data: rows }, { data: profileData, error: profileError }, { data: sub }] =
      await Promise.all([
        supabase.from('platform_connections').select('platform, platform_username'),
        supabase.from('profiles').select('tone, auto_publish, email_notifications, github_username').single(),
        supabase.from('subscriptions').select('status').single(),
      ])

    if (profileError) {
      console.error('Failed to load profile settings:', profileError.message)
    }

    const connections = ['twitter', 'linkedin', 'bluesky'].map((platform) => {
      const row = rows?.find(
        (r: { platform: string; platform_username: string | null }) => r.platform === platform
      )
      return { platform, platform_username: row?.platform_username ?? null, connected: !!row }
    })

    const profile = {
      tone: profileData?.tone ?? 'casual',
      auto_publish: profileData?.auto_publish ?? false,
      email_notifications: profileData?.email_notifications ?? true,
    }

    const plan: 'free' | 'pro' = sub?.status === 'active' ? 'pro' : 'free'
    const githubUsername: string | null = profileData?.github_username ?? null

    return { connections, profile, plan, githubUsername }
  })
}

export default function SettingsPage() {
  const { data, error, isLoading, mutate } = useSettingsData()

  if (isLoading) return <SettingsSkeleton />
  if (error || !data) return <ErrorState retry={() => mutate()} />

  return (
    <SettingsClient
      initialConnections={data.connections}
      initialProfile={data.profile}
      initialPlan={data.plan}
      githubUsername={data.githubUsername}
    />
  )
}
