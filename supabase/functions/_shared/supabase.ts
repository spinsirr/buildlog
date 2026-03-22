import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export function getSupabaseUrl(): string {
  return Deno.env.get('SUPABASE_URL') ?? requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
}

export function getAnonKey(): string {
  return Deno.env.get('SUPABASE_ANON_KEY') ?? requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

export function getServiceRoleKey(): string {
  return requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
}

export function createServiceClient(): SupabaseClient {
  return createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function createUserClient(authHeader: string): SupabaseClient {
  return createClient(getSupabaseUrl(), getAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  })
}
