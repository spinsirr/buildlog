'use client'

import { SettingsClient } from '@/components/settings-client'
import { useSettingsData } from '@/lib/hooks/use-dashboard-data'
import { SettingsSkeleton } from './loading'

export default function SettingsPage() {
  const { data, isLoading } = useSettingsData()

  if (isLoading || !data) return <SettingsSkeleton />

  return (
    <SettingsClient
      initialConnections={data.connections}
      initialProfile={data.profile}
      initialPlan={data.plan}
      githubUsername={data.githubUsername}
    />
  )
}
