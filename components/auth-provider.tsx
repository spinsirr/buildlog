'use client'

import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type AuthContextValue = {
  session: Session | null
  userId: string | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  userId: null,
  loading: true,
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, s: Session | null) => {
      setSession(s)

      if (event === 'INITIAL_SESSION') {
        setLoading(false)
      }

      if (event === 'SIGNED_OUT') {
        router.replace('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, router])

  const userId = session?.user?.id ?? null
  const value = useMemo(() => ({ session, userId, loading }), [session, userId, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
