'use client'

import { FetchError } from '@/components/fetch-error'
import { SettingsClient } from '@/components/settings-client'
import { useSettingsData } from '@/lib/hooks/use-dashboard-data'
import { SettingsSkeleton } from './loading'

export default function SettingsPage() {
  const { data, error, isLoading, mutate } = useSettingsData()

  if (isLoading || !data) return <SettingsSkeleton />
  if (error) return <FetchError onRetry={() => mutate()} />

  return <SettingsClient />
}
