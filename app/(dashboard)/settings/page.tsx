'use client'

import useSWR from 'swr'
import { SettingsClient } from '@/components/settings-client'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

async function fetchSettingsData() {
  const [{ data: rows }, { data: profileData, error: profileError }] = await Promise.all([
    supabase.from('platform_connections').select('platform, platform_username'),
    supabase.from('profiles').select('tone, auto_publish, email_notifications').single(),
  ])

  if (profileError) {
    console.error('Failed to load profile settings:', profileError.message)
  }

  const connections = ['twitter', 'linkedin', 'bluesky'].map((platform) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = rows?.find((r: any) => r.platform === platform)
    return { platform, platform_username: row?.platform_username ?? null, connected: !!row }
  })

  const profile = {
    tone: profileData?.tone ?? 'casual',
    auto_publish: profileData?.auto_publish ?? false,
    email_notifications: profileData?.email_notifications ?? true,
  }

  return { connections, profile }
}

function SettingsSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-8 w-28" />
      <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-6 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 rounded-lg border border-zinc-800"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-6 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-56" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}

function ErrorState({ retry }: { retry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
        <span className="text-red-400 text-lg">!</span>
      </div>
      <p className="text-sm text-zinc-400">Something went wrong loading settings.</p>
      <button
        type="button"
        onClick={retry}
        className="px-4 py-2 text-sm rounded-md bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const { data, error, isLoading, mutate } = useSWR('settings-data', fetchSettingsData)

  if (isLoading) return <SettingsSkeleton />
  if (error || !data) return <ErrorState retry={() => mutate()} />

  return (
    <SettingsClient
      initialConnections={data.connections}
      initialProfile={data.profile}
    />
  )
}
