'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    // getSession() reads from local cache — near-instant for logged-in users
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: unknown } }) => {
      if (!session) {
        router.replace('/login')
      } else {
        setChecked(true)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: unknown) => {
      if (!session) {
        router.replace('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  if (!checked) return null

  return <>{children}</>
}
