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
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const [{ data: rows }, { data: profileData, error: profileError }, { data: sub }] =
      await Promise.all([
        supabase.from('platform_connections').select('platform, platform_username').eq('user_id', user.id),
        supabase
          .from('profiles')
          .select('tone, auto_publish, email_notifications, publish_delay_minutes, github_username')
          .eq('id', user.id)
          .single(),
        supabase.from('subscriptions').select('status').eq('user_id', user.id).maybeSingle(),
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
      publish_delay_minutes: profileData?.publish_delay_minutes ?? 0,
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
