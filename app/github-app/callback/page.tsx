'use client'

import { Loader2 } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function GitHubAppCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      }
    >
      <GitHubAppCallback />
    </Suspense>
  )
}

function GitHubAppCallback() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const installationId = searchParams.get('installation_id')
    const setupAction = searchParams.get('setup_action')

    if (!installationId || setupAction === 'delete') {
      router.replace('/repos')
      return
    }

    const supabase = createClient()

    async function saveInstallation() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }

      await supabase.functions.invoke('github-app', {
        body: {
          action: 'set-installation',
          installation_id: parseInt(installationId!, 10),
        },
      })

      router.replace('/repos')
    }

    saveInstallation()
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        <p className="text-sm text-zinc-500">Setting up GitHub App...</p>
      </div>
    </div>
  )
}
