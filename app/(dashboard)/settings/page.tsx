import { redirect } from 'next/navigation'
import { SettingsClient } from '@/components/settings-client'
import type { Plan } from '@/lib/plans'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: rows }, { data: profileData, error: profileError }, { data: sub }] =
    await Promise.all([
      supabase
        .from('platform_connections')
        .select('platform, platform_username')
        .eq('user_id', user.id),
      supabase
        .from('profiles')
        .select(
          'tone, auto_publish, email_notifications, publish_delay_minutes, github_username, x_premium'
        )
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
    x_premium: profileData?.x_premium ?? false,
  }

  const plan: Plan = sub?.status === 'active' ? 'pro' : 'free'
  const githubUsername: string | null = profileData?.github_username ?? null

  return (
    <SettingsClient
      initialConnections={connections}
      initialProfile={profile}
      initialPlan={plan}
      githubUsername={githubUsername}
    />
  )
}
