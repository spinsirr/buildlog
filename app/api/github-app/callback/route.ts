import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const installationId = searchParams.get('installation_id')
  const setupAction = searchParams.get('setup_action')

  if (!installationId || setupAction === 'delete') {
    return NextResponse.redirect(new URL('/dashboard/repos', request.url))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const serviceClient = createServiceClient()

  await serviceClient
    .from('profiles')
    .update({ github_installation_id: parseInt(installationId) })
    .eq('id', user.id)

  return NextResponse.redirect(new URL('/dashboard/repos', request.url))
}
