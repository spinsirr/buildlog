import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  if (code) {
    const supabase = await createClient()
    const { data } = await supabase.auth.exchangeCodeForSession(code)

    // Store GitHub provider_token for later API calls
    if (data.session?.provider_token && data.session?.user?.id) {
      const serviceClient = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      await serviceClient
        .from('profiles')
        .update({ github_token: data.session.provider_token })
        .eq('id', data.session.user.id)
    }
  }
  return NextResponse.redirect(new URL('/dashboard', request.url))
}
