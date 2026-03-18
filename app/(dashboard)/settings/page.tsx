'use client'

import { useEffect, useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react'

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
]

export default function SettingsPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [actionPlatform, setActionPlatform] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/settings/connections')
      .then((r) => r.json())
      .then((data) => {
        setConnections(data.connections ?? [])
        setLoading(false)
      })
  }, [])

  function handleConnect(platform: string) {
    setActionPlatform(platform)
    startTransition(async () => {
      const res = await fetch(`/api/auth/${platform}`, { method: 'POST', redirect: 'follow' })
      // The API redirects to Twitter — follow it
      if (res.redirected) {
        window.location.href = res.url
      }
      setActionPlatform(null)
    })
  }

  function handleDisconnect(platform: string) {
    setActionPlatform(platform)
    startTransition(async () => {
      await fetch(`/api/auth/${platform}/disconnect`, { method: 'POST' })
      setConnections((prev) =>
        prev.map((c) => (c.platform === platform ? { ...c, connected: false, platform_username: null } : c))
      )
      setActionPlatform(null)
    })
  }

  const getConnection = (id: string) => connections.find((c) => c.platform === id)

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
          {loading ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : (
            PLATFORMS.map((platform) => {
              const conn = getConnection(platform.id)
              const connected = conn?.connected ?? false
              const busy = actionPlatform === platform.id && isPending

              return (
                <div
                  key={platform.id}
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
                    disabled={busy}
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
              )
            })
          )}

          <p className="text-xs text-zinc-600 pt-1">
            LinkedIn and Bluesky support coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
