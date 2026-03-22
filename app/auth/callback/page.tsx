'use client'

import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const handleCallback = async () => {
      // Extract the auth code from URL and exchange it for a session
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          router.replace(`/login?error=auth_failed&message=${encodeURIComponent(error.message)}`)
          return
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        router.replace('/dashboard')
      } else {
        router.replace('/login?error=auth_failed')
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        <p className="text-sm text-zinc-500">Signing you in...</p>
      </div>
    </div>
  )
}
