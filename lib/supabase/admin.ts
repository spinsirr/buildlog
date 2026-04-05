import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client for use in API routes.
 * Bypasses RLS — use only in server-side code with proper auth checks.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )
}
