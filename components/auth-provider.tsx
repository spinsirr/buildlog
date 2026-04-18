'use client'

import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// We intentionally expose only `userId` + `loading` — not the full `Session`.
// Supabase fires `onAuthStateChange` on every TOKEN_REFRESHED (~every 50 min),
// which produces a brand-new Session object even though the authenticated
// user hasn't changed. Including the session in context value would force
// every SWR consumer in the tree to re-render on each refresh. Callers that
// need the access token should pull it from `supabase.auth.getSession()`
// directly (see lib/edge-function.ts).
type AuthContextValue = {
  userId: string | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>({
  userId: null,
  loading: true,
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, s: Session | null) => {
      // Only update userId when it actually changes — TOKEN_REFRESHED keeps
      // the same user id, so skipping the setState short-circuits a context
      // value change that would otherwise re-render the whole dashboard tree.
      setUserId((prev) => {
        const next = s?.user?.id ?? null
        return prev === next ? prev : next
      })

      if (event === 'INITIAL_SESSION') {
        setLoading(false)
      }

      if (event === 'SIGNED_OUT') {
        router.replace('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, router])

  const value = useMemo(() => ({ userId, loading }), [userId, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
