import { createClient } from '@/lib/supabase/client'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Call a Supabase Edge Function by name (with optional path segments).
 * Handles auth header, apikey, and JSON content type automatically.
 */
export async function callEdgeFunction<T = unknown>(
  name: string,
  options?: {
    method?: string
    body?: unknown
    path?: string
  }
): Promise<{ data: T; ok: true } | { error: string; ok: false }> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return { error: 'Not authenticated', ok: false }

  const pathSuffix = options?.path ? `/${options.path}` : ''
  const url = `${SUPABASE_URL}/functions/v1/${name}${pathSuffix}`

  const res = await fetch(url, {
    method: options?.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: ANON_KEY,
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: data.error ?? `Request failed (${res.status})`, ok: false }
  }

  return { data: data as T, ok: true }
}
