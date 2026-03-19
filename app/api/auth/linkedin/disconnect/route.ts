import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('platform_connections')
    .delete()
    .eq('user_id', user.id)
    .eq('platform', 'linkedin')

  return NextResponse.json({ ok: true })
}
