'use client'

import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // Supabase client library automatically handles the code exchange
    // when it detects the auth callback URL parameters.
    // We just need to check for the session after a brief delay.
    const handleCallback = async () => {
      const { error } = await supabase.auth.getSession()

      if (error) {
        router.replace(`/login?error=auth_failed&message=${encodeURIComponent(error.message)}`)
        return
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
