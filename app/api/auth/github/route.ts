import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const origin = new URL(request.url).origin
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${origin}/auth/callback`,
      scopes: 'read:user user:email repo admin:repo_hook',
    },
  })
  if (error || !data.url) redirect('/login?error=oauth')
  redirect(data.url)
}
