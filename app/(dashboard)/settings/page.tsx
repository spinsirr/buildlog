import type { Metadata } from 'next'
import { SettingsClient } from '@/components/settings-client'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()

  const [{ data: rows }, { data: profileData, error: profileError }] = await Promise.all([
    supabase.from('platform_connections').select('platform, platform_username'),
    supabase.from('profiles').select('tone, auto_publish, email_notifications').single(),
  ])

  if (profileError) {
    console.error('Failed to load profile settings:', profileError.message)
  }

  const connections = ['twitter', 'linkedin', 'bluesky'].map((platform) => {
    const row = rows?.find((r) => r.platform === platform)
    return { platform, platform_username: row?.platform_username ?? null, connected: !!row }
  })

  const profile = {
    tone: profileData?.tone ?? 'casual',
    auto_publish: profileData?.auto_publish ?? false,
    email_notifications: profileData?.email_notifications ?? true,
  }

  return <SettingsClient initialConnections={connections} initialProfile={profile} />
}
