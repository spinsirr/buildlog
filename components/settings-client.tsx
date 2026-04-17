'use client'

import { Check, ChevronDown, CreditCard, Globe, Loader2, Sparkles } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/components/auth-provider'
import { ChangelogUrlCopy } from '@/components/changelog-url-copy'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { callEdgeFunction } from '@/lib/edge-function'
import { useSettingsData } from '@/lib/hooks/use-dashboard-data'
import { PLANS } from '@/lib/plans'
import { PLATFORM_IDS, platformConfig } from '@/lib/platforms'
import { createClient } from '@/lib/supabase/client'
import type { ProfileSettings } from '@/lib/types'

const PLATFORMS = PLATFORM_IDS.map((id) => ({
  id,
  label: platformConfig[id].label,
  description: platformConfig[id].description,
  icon:
    id === 'twitter' ? (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ) : id === 'linkedin' ? (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ) : (
      <svg viewBox="0 0 600 530" className="h-5 w-5 fill-current" aria-hidden="true">
        <path d="m135.72 44.03c66.496 49.921 138.02 151.14 164.28 205.46 26.262-54.316 97.782-155.54 164.28-205.46 47.98-36.021 125.72-63.892 125.72 24.795 0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.3797-3.6904-10.832-3.7077-7.8964-0.0174-2.9357-1.1937 0.51669-3.7077 7.8964-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.4491-163.25-81.433-5.9562-21.282-16.111-152.36-16.111-170.07 0-88.687 77.742-60.816 125.72-24.795z" />
      </svg>
    ),
}))

const TONES = [
  { value: 'casual', label: 'Casual', description: 'Friendly and conversational' },
  { value: 'professional', label: 'Professional', description: 'Polished and authoritative' },
  { value: 'technical', label: 'Technical', description: 'Detailed with terminology' },
] as const

export function SettingsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const { userId } = useAuth()
  const { data, mutate } = useSettingsData()
  const connections = data?.connections ?? []
  const profile = data?.profile ?? {
    tone: 'casual',
    auto_publish: false,
    email_notifications: true,
    x_premium: false,
    public_changelog: true,
  }
  const plan = data?.plan ?? 'free'
  const githubUsername = data?.githubUsername ?? null
  const [isPending, startTransition] = useTransition()

  // Handle OAuth redirect results (?connected=twitter or ?error=twitter_denied)
  // and Stripe checkout results (?checkout=success or ?checkout=canceled)
  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    const checkout = searchParams.get('checkout')

    if (checkout === 'success') {
      toast.success('Welcome to Pro! Your subscription is now active.')
      router.replace('/settings', { scroll: false })
    } else if (checkout === 'canceled') {
      toast('Checkout canceled — no changes made.')
      router.replace('/settings', { scroll: false })
    } else if (connected) {
      const label = PLATFORMS.find((p) => p.id === connected)?.label ?? connected
      toast.success(`${label} connected successfully`)
      mutate()
      router.replace('/settings', { scroll: false })
    } else if (error) {
      const platform = error.split('_')[0]
      const label = PLATFORMS.find((p) => p.id === platform)?.label ?? platform
      const detail = searchParams.get('detail')
      toast.error('Connection failed', {
        description: `Failed to connect ${label}: ${error}${detail ? ` (${decodeURIComponent(detail)})` : ''}`,
      })
      router.replace('/settings', { scroll: false })
    }
  }, [searchParams, router, mutate])
  const [actionPlatform, setActionPlatform] = useState<string | null>(null)
  const [savingTone, setSavingTone] = useState(false)
  const [billingLoading, setBillingLoading] = useState(false)
  const [showBskyForm, setShowBskyForm] = useState(false)
  const [bskyHandle, setBskyHandle] = useState('')
  const [bskyPassword, setBskyPassword] = useState('')
  const [bskyLoading, setBskyLoading] = useState(false)

  const handleUpgrade = useCallback(async () => {
    setBillingLoading(true)
    try {
      const result = await callEdgeFunction<{ url: string }>('billing', {
        path: 'checkout',
        body: { return_url: window.location.origin },
      })
      if (!result.ok) {
        toast.error('Checkout failed', { description: result.error ?? 'Failed to start checkout' })
        return
      }
      window.location.href = result.data.url
    } finally {
      setBillingLoading(false)
    }
  }, [])

  async function handleManageSubscription() {
    setBillingLoading(true)
    try {
      const result = await callEdgeFunction<{ url: string }>('billing', {
        path: 'portal',
        body: { return_url: window.location.origin },
      })
      if (!result.ok) {
        toast.error('Billing portal failed', {
          description: result.error ?? 'Failed to open billing portal',
        })
        return
      }
      window.location.href = result.data.url
    } finally {
      setBillingLoading(false)
    }
  }

  async function handleProfileToggle(
    field: keyof ProfileSettings,
    value: boolean,
    errorMsg: string
  ) {
    if (!userId) return
    mutate(
      async (current) => {
        const { error } = await supabase
          .from('profiles')
          .update({ [field]: value })
          .eq('id', userId)
        if (error) {
          toast.error('Update failed', { description: errorMsg })
          throw error
        }
        return current ? { ...current, profile: { ...current.profile, [field]: value } } : current
      },
      {
        optimisticData: (current) =>
          current ? { ...current, profile: { ...current.profile, [field]: value } } : current!,
        rollbackOnError: true,
        revalidate: false,
      }
    )
  }

  function handleAutoPublishToggle(checked: boolean) {
    handleProfileToggle('auto_publish', checked, 'Failed to update auto-publish setting')
  }

  function handleEmailNotificationsToggle(checked: boolean) {
    handleProfileToggle('email_notifications', checked, 'Failed to update notification setting')
  }

  function handleXPremiumToggle(checked: boolean) {
    handleProfileToggle('x_premium', checked, 'Failed to update X Premium setting')
  }

  function handlePublicChangelogToggle(checked: boolean) {
    handleProfileToggle('public_changelog', checked, 'Failed to update directory visibility')
  }

  async function handleToneChange(newTone: string) {
    if (!userId) return
    setSavingTone(true)
    try {
      await mutate(
        async (current) => {
          await supabase.from('profiles').update({ tone: newTone }).eq('id', userId)
          return current ? { ...current, profile: { ...current.profile, tone: newTone } } : current
        },
        {
          optimisticData: (current) =>
            current ? { ...current, profile: { ...current.profile, tone: newTone } } : current!,
          rollbackOnError: true,
          revalidate: false,
        }
      )
    } finally {
      setSavingTone(false)
    }
  }

  async function handleConnect(platform: string) {
    // Twitter is Pro-only
    if (platform === 'twitter' && plan === 'free') {
      toast.error('Twitter requires Pro', {
        description: 'Upgrade to Pro to connect Twitter.',
        action: { label: 'Upgrade', onClick: () => handleUpgrade() },
      })
      return
    }
    if (platform === 'bluesky') {
      setShowBskyForm(true)
      return
    }
    setActionPlatform(platform)

    const result = await callEdgeFunction<{ url: string }>('social-auth', {
      path: platform,
      body: { return_url: window.location.origin },
    })

    if (!result.ok) {
      if (result.code === 'plan_limit') {
        toast.error('Platform limit reached', {
          description: result.error,
          action: { label: 'Upgrade', onClick: () => handleUpgrade() },
        })
      } else {
        toast.error('Connection failed', {
          description: result.error ?? 'Failed to start connection',
        })
      }
      setActionPlatform(null)
      return
    }

    window.location.href = result.data.url
  }

  async function handleBskySubmit(e: React.FormEvent) {
    e.preventDefault()
    setBskyLoading(true)
    try {
      const result = await callEdgeFunction<{ ok: boolean; username?: string }>('social-auth', {
        path: 'bluesky',
        body: { handle: bskyHandle, appPassword: bskyPassword },
      })
      if (!result.ok) {
        if (result.code === 'plan_limit') {
          toast.error('Platform limit reached', {
            description: result.error,
            action: { label: 'Upgrade', onClick: () => handleUpgrade() },
          })
        } else {
          toast.error('Connection failed', {
            description: result.error ?? 'Failed to connect Bluesky',
          })
        }
        return
      }
      setShowBskyForm(false)
      setBskyHandle('')
      setBskyPassword('')
      toast.success('Bluesky connected')
      mutate()
    } finally {
      setBskyLoading(false)
    }
  }

  function handleDisconnect(platform: string) {
    setActionPlatform(platform)
    startTransition(async () => {
      await callEdgeFunction('social-disconnect', { path: platform })
      const label = PLATFORMS.find((p) => p.id === platform)?.label ?? platform
      toast.success(`${label} disconnected`)
      setActionPlatform(null)
      mutate()
    })
  }

  const getConnection = (id: string) => connections.find((c) => c.platform === id)
  const {
    tone,
    auto_publish: autoPublish,
    email_notifications: emailNotifications,
    x_premium: xPremium,
    public_changelog: publicChangelog,
  } = profile

  const isPro = plan === 'pro'
  const limits = PLANS[plan]
  const isTwitterConnected = connections.find((c) => c.platform === 'twitter')?.connected ?? false

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-display font-bold uppercase tracking-tight text-zinc-50">
          Settings
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Manage your plan, connected platforms, and post preferences.
        </p>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-zinc-50">Plan & Billing</CardTitle>
              <p className="text-sm text-zinc-400 mt-1">
                {isPro
                  ? 'Pro plan — unlimited everything.'
                  : `Free — ${limits.posts_per_month} posts/mo, ${limits.repos} repo, ${limits.platforms} platform.`}
              </p>
            </div>
            <Badge
              className={
                isPro
                  ? 'bg-neo-accent/10 text-neo-accent border-neo-accent/20'
                  : 'bg-zinc-800 text-zinc-400 border-0'
              }
            >
              {isPro ? 'Pro' : 'Free'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isPro ? (
            <Button
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              disabled={billingLoading}
              onClick={handleManageSubscription}
            >
              {billingLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Manage Subscription
            </Button>
          ) : (
            <Button
              className="bg-neo-accent hover:bg-neo-accent/90 text-white border-2 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(255,255,255,0.1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
              disabled={billingLoading}
              onClick={handleUpgrade}
            >
              {billingLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Upgrade to Pro
            </Button>
          )}
        </CardContent>
      </Card>

      {githubUsername && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-zinc-400" />
              <div>
                <CardTitle className="text-zinc-50">Public Changelog</CardTitle>
                <p className="text-sm text-zinc-400 mt-1">
                  Share your build log with followers and the world.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ChangelogUrlCopy username={githubUsername} />
            <div className="flex items-center justify-between pt-4 border-t-2 border-zinc-800">
              <div>
                <Label className="text-sm font-medium text-zinc-200">
                  List in public directory
                </Label>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Show up on /changelog and landing showcases. Your URL stays accessible either way.
                </p>
              </div>
              <Switch checked={publicChangelog} onCheckedChange={handlePublicChangelogToggle} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-50">Connected Platforms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {PLATFORMS.map((platform) => {
            const conn = getConnection(platform.id)
            const connected = conn?.connected ?? false
            const busy = actionPlatform === platform.id && isPending
            const isBsky = platform.id === 'bluesky'

            return (
              <div key={platform.id} className="space-y-3">
                <div className="flex items-center justify-between p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
                  <div className="flex items-center gap-3">
                    <div className="text-zinc-300">{platform.icon}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-200">{platform.label}</span>
                        {connected ? (
                          <Badge className="bg-neo-mint/10 text-neo-mint border-neo-mint/20 text-[10px]">
                            Connected
                          </Badge>
                        ) : (
                          <Badge className="bg-zinc-800 text-zinc-400 border-0 text-[10px]">
                            Not connected
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {connected && conn?.platform_username
                          ? `@${conn.platform_username}`
                          : platform.description}
                      </p>
                    </div>
                  </div>

                  {platform.id === 'twitter' && plan === 'free' && !connected ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleConnect(platform.id)}
                      className="border-zinc-700 text-zinc-500 hover:text-neo-accent hover:border-neo-accent/50 gap-1.5"
                    >
                      <Sparkles className="h-3 w-3" />
                      Pro
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant={connected ? 'outline' : 'default'}
                      disabled={busy || (isBsky && bskyLoading)}
                      onClick={() =>
                        connected ? handleDisconnect(platform.id) : handleConnect(platform.id)
                      }
                      className={
                        connected
                          ? 'border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/5'
                          : 'bg-neo-accent hover:bg-neo-accent/90 text-white border-2 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(255,255,255,0.1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none'
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
                  )}
                </div>

                {isBsky && showBskyForm && !connected && (
                  <form
                    onSubmit={handleBskySubmit}
                    className="ml-4 sm:ml-8 p-4 rounded-lg border border-zinc-800 bg-zinc-900/50 space-y-3"
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
                        className="w-full min-w-0 px-3 py-2 text-sm rounded-md border border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-neo-accent focus:border-transparent"
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
                        className="w-full min-w-0 px-3 py-2 text-sm rounded-md border border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-neo-accent focus:border-transparent"
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Use an{' '}
                      <a
                        href="https://bsky.app/settings/app-passwords"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neo-accent hover:text-neo-accent/80 underline"
                      >
                        App Password
                      </a>{' '}
                      from your Bluesky settings.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        disabled={bskyLoading}
                        className="bg-neo-accent hover:bg-neo-accent/90 text-white border-2 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(255,255,255,0.1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                      >
                        {bskyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Connect'}
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
          })}
        </CardContent>
      </Card>

      <Collapsible defaultOpen={false}>
        <Card className="bg-zinc-900 border-zinc-800">
          <CollapsibleTrigger className="w-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-zinc-50">Post Tone</CardTitle>
                  <span className="text-xs text-zinc-500 capitalize">{tone}</span>
                </div>
                <ChevronDown className="h-4 w-4 text-zinc-500 transition-transform [[data-open]_&]:rotate-180" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-3">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  disabled={savingTone}
                  onClick={() => handleToneChange(t.value)}
                  className={`w-full flex items-center justify-between p-4 rounded-lg border transition-colors text-left ${
                    tone === t.value
                      ? 'border-neo-accent/50 bg-neo-accent/5'
                      : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/50'
                  }`}
                >
                  <div>
                    <Label
                      className={`text-sm font-medium ${tone === t.value ? 'text-neo-accent' : 'text-zinc-200'}`}
                    >
                      {t.label}
                    </Label>
                    <p className="text-xs text-zinc-400 mt-0.5">{t.description}</p>
                  </div>
                  {tone === t.value && <Check className="h-4 w-4 text-neo-accent shrink-0" />}
                </button>
              ))}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible defaultOpen={false}>
        <Card className="bg-zinc-900 border-zinc-800">
          <CollapsibleTrigger className="w-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-zinc-50">Preferences</CardTitle>
                <ChevronDown className="h-4 w-4 text-zinc-500 transition-transform [[data-open]_&]:rotate-180" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-0 divide-y divide-zinc-800">
              <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                <div>
                  <Label className="text-sm font-medium text-zinc-200">Auto-publish</Label>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Publish posts from GitHub events immediately.
                  </p>
                </div>
                <Switch checked={autoPublish} onCheckedChange={handleAutoPublishToggle} />
              </div>
              <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                <div>
                  <Label className="text-sm font-medium text-zinc-200">Email notifications</Label>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Get notified when posts are published or drafts are created.
                  </p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={handleEmailNotificationsToggle}
                />
              </div>
              <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                <div>
                  <Label className="text-sm font-medium text-zinc-200">
                    X Premium (longer posts)
                  </Label>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {isTwitterConnected
                      ? 'Generate posts up to 4,000 characters instead of 280.'
                      : 'Requires an X Premium subscription. Connect your X account first.'}
                  </p>
                </div>
                <Switch
                  checked={xPremium}
                  onCheckedChange={handleXPremiumToggle}
                  disabled={!isTwitterConnected}
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  )
}
