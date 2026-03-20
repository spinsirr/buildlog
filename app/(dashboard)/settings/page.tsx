'use client'

import useSWR from 'swr'
import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Check, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type Connection = {
  platform: string
  platform_username: string | null
  connected: boolean
}

const PLATFORMS = [
  {
    id: 'twitter',
    label: 'X (Twitter)',
    description: 'Post build updates to your X timeline',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    description: 'Share build updates with your professional network',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    id: 'bluesky',
    label: 'Bluesky',
    description: 'Post build updates to the Bluesky network',
    icon: (
      <svg viewBox="0 0 600 530" className="h-5 w-5 fill-current" aria-hidden="true">
        <path d="m135.72 44.03c66.496 49.921 138.02 151.14 164.28 205.46 26.262-54.316 97.782-155.54 164.28-205.46 47.98-36.021 125.72-63.892 125.72 24.795 0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.3797-3.6904-10.832-3.7077-7.8964-0.0174-2.9357-1.1937 0.51669-3.7077 7.8964-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.4491-163.25-81.433-5.9562-21.282-16.111-152.36-16.111-170.07 0-88.687 77.742-60.816 125.72-24.795z" />
      </svg>
    ),
  },
]

async function fetchConnections() {
  const { data: rows } = await supabase
    .from('platform_connections')
    .select('platform, platform_username')
  const connections = ['twitter', 'linkedin', 'bluesky'].map(platform => {
    const row = rows?.find(r => r.platform === platform)
    return { platform, platform_username: row?.platform_username ?? null, connected: !!row }
  })
  return { connections }
}

async function fetchProfile() {
  const { data } = await supabase
    .from('profiles')
    .select('tone, auto_publish, email_notifications')
    .single()
  return {
    tone: data?.tone ?? 'casual',
    auto_publish: data?.auto_publish ?? false,
    email_notifications: data?.email_notifications ?? true,
  }
}

const TONES = [
  { value: 'casual', label: 'Casual', description: 'Friendly and conversational' },
  { value: 'professional', label: 'Professional', description: 'Polished and authoritative' },
  { value: 'technical', label: 'Technical', description: 'Detailed with terminology' },
] as const

export default function SettingsPage() {
  const { data, isLoading, mutate } = useSWR<{ connections: Connection[] }>(
    'settings-connections',
    fetchConnections
  )
  const { data: profileData, mutate: mutateProfile } = useSWR<{ tone: string; auto_publish: boolean; email_notifications: boolean }>(
    'settings-profile',
    fetchProfile
  )
  const [isPending, startTransition] = useTransition()
  const [actionPlatform, setActionPlatform] = useState<string | null>(null)
  const [savingTone, setSavingTone] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [showBskyForm, setShowBskyForm] = useState(false)
  const [bskyHandle, setBskyHandle] = useState('')
  const [bskyPassword, setBskyPassword] = useState('')
  const [bskyLoading, setBskyLoading] = useState(false)

  const connections = data?.connections ?? []
  const tone = profileData?.tone ?? 'casual'
  const autoPublish = profileData?.auto_publish ?? false
  const emailNotifications = profileData?.email_notifications ?? true

  async function handleAutoPublishToggle(checked: boolean) {
    mutateProfile({ ...profileData!, auto_publish: checked }, { revalidate: false })
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({ auto_publish: checked }).eq('id', user.id)
    }
  }

  async function handleEmailNotificationsToggle(checked: boolean) {
    mutateProfile({ ...profileData!, email_notifications: checked }, { revalidate: false })
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({ email_notifications: checked }).eq('id', user.id)
    }
  }

  async function handleToneChange(newTone: string) {
    setSavingTone(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('profiles').update({ tone: newTone }).eq('id', user.id)
      }
      mutateProfile({ ...profileData!, tone: newTone }, { revalidate: false })
    } finally {
      setSavingTone(false)
    }
  }

  function handleConnect(platform: string) {
    if (platform === 'bluesky') {
      setShowBskyForm(true)
      return
    }
    setActionPlatform(platform)
    startTransition(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/social-auth/${platform}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
        },
      )
      const data = await res.json()
      if (!res.ok) {
        setConnectError(data.error ?? 'Failed to connect platform')
        setActionPlatform(null)
        return
      }
      if (data.url) {
        window.location.href = data.url
      }
      setActionPlatform(null)
    })
  }

  async function handleBskySubmit(e: React.FormEvent) {
    e.preventDefault()
    setBskyLoading(true)
    setConnectError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/social-auth/bluesky`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ handle: bskyHandle, appPassword: bskyPassword }),
        },
      )
      const data = await res.json()
      if (!res.ok) {
        setConnectError(data.error ?? 'Failed to connect Bluesky')
        return
      }
      setShowBskyForm(false)
      setBskyHandle('')
      setBskyPassword('')
      mutate()
    } finally {
      setBskyLoading(false)
    }
  }

  function handleDisconnect(platform: string) {
    setActionPlatform(platform)
    startTransition(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/social-disconnect/${platform}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
        },
      )
      mutate({
        connections: connections.map(c =>
          c.platform === platform ? { ...c, connected: false, platform_username: null } : c
        ),
      }, { revalidate: true })
      setActionPlatform(null)
    })
  }

  const getConnection = (id: string) => connections.find(c => c.platform === id)

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-zinc-50">Settings</h1>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-50">Connected Platforms</CardTitle>
          <CardDescription className="text-zinc-500">
            Connect your social accounts to publish build updates automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {connectError && (
            <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
              {connectError}
              <button
                type="button"
                onClick={() => setConnectError(null)}
                className="ml-2 underline hover:no-underline text-xs"
              >
                Dismiss
              </button>
            </div>
          )}
          {isLoading ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : (
            PLATFORMS.map((platform) => {
              const conn = getConnection(platform.id)
              const connected = conn?.connected ?? false
              const busy = actionPlatform === platform.id && isPending
              const isBsky = platform.id === 'bluesky'

              return (
                <div key={platform.id} className="space-y-3">
                  <div
                    className="flex items-center justify-between p-4 rounded-lg border border-zinc-800 bg-zinc-900/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-zinc-300">{platform.icon}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-200">
                            {platform.label}
                          </span>
                          {connected ? (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                              Connected
                            </Badge>
                          ) : (
                            <Badge className="bg-zinc-800 text-zinc-500 border-0 text-[10px]">
                              Not connected
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {connected && conn?.platform_username
                            ? `@${conn.platform_username}`
                            : platform.description}
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant={connected ? 'outline' : 'default'}
                      disabled={busy || (isBsky && bskyLoading)}
                      onClick={() => connected ? handleDisconnect(platform.id) : handleConnect(platform.id)}
                      className={
                        connected
                          ? 'border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/5'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white border-0'
                      }
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : connected ? (
                        'Disconnect'
                      ) : (
                        'Connect'
                      )}
                    </Button>
                  </div>

                  {isBsky && showBskyForm && !connected && (
                    <form
                      onSubmit={handleBskySubmit}
                      className="ml-8 p-4 rounded-lg border border-zinc-800 bg-zinc-900/50 space-y-3"
                    >
                      <div className="space-y-2">
                        <label htmlFor="bsky-handle" className="text-xs font-medium text-zinc-300">
                          Handle
                        </label>
                        <input
                          id="bsky-handle"
                          type="text"
                          placeholder="yourname.bsky.social"
                          value={bskyHandle}
                          onChange={(e) => setBskyHandle(e.target.value)}
                          required
                          className="w-full px-3 py-2 text-sm rounded-md border border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="bsky-password" className="text-xs font-medium text-zinc-300">
                          App Password
                        </label>
                        <input
                          id="bsky-password"
                          type="password"
                          placeholder="xxxx-xxxx-xxxx-xxxx"
                          value={bskyPassword}
                          onChange={(e) => setBskyPassword(e.target.value)}
                          required
                          className="w-full px-3 py-2 text-sm rounded-md border border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                      <p className="text-[11px] text-zinc-500">
                        Use an App Password from Settings &rarr; App Passwords in the Bluesky app.
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="submit"
                          size="sm"
                          disabled={bskyLoading}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white border-0"
                        >
                          {bskyLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            'Connect'
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setShowBskyForm(false)}
                          className="border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-50">Post Tone</CardTitle>
          <CardDescription className="text-zinc-500">
            Choose the voice for your generated posts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {TONES.map((t) => (
            <button
              key={t.value}
              type="button"
              disabled={savingTone}
              onClick={() => handleToneChange(t.value)}
              className={`w-full flex items-center justify-between p-4 rounded-lg border transition-colors text-left ${
                tone === t.value
                  ? 'border-indigo-500/50 bg-indigo-500/5'
                  : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/50'
              }`}
            >
              <div>
                <Label className={`text-sm font-medium ${tone === t.value ? 'text-indigo-400' : 'text-zinc-200'}`}>
                  {t.label}
                </Label>
                <p className="text-xs text-zinc-500 mt-0.5">{t.description}</p>
              </div>
              {tone === t.value && <Check className="h-4 w-4 text-indigo-400 shrink-0" />}
            </button>
          ))}
        </CardContent>
      </Card>
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-50">Auto-Publish</CardTitle>
          <CardDescription className="text-zinc-500">
            Automatically publish posts when generated from webhooks instead of saving as drafts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
            <div>
              <Label className="text-sm font-medium text-zinc-200">
                Publish immediately
              </Label>
              <p className="text-xs text-zinc-500 mt-0.5">
                Posts from GitHub events will be published right away.
              </p>
            </div>
            <Switch
              checked={autoPublish}
              onCheckedChange={handleAutoPublishToggle}
            />
          </div>
        </CardContent>
      </Card>
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-50">Email Notifications</CardTitle>
          <CardDescription className="text-zinc-500">
            Receive email alerts when posts are published or drafts are created.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
            <div>
              <Label className="text-sm font-medium text-zinc-200">
                Send email notifications
              </Label>
              <p className="text-xs text-zinc-500 mt-0.5">
                Get notified via email in addition to in-app notifications.
              </p>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={handleEmailNotificationsToggle}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
