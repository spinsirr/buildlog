import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function POST() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${process.env.NEXTAUTH_URL}/auth/callback`,
      scopes: 'read:user user:email repo admin:repo_hook',
    },
  })
  if (error || !data.url) redirect('/login?error=oauth')
  redirect(data.url)
}
