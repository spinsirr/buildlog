import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: rows } = await supabase
    .from('platform_connections')
    .select('platform, platform_username')
    .eq('user_id', user.id)

  const connections = ['twitter', 'linkedin', 'bluesky'].map((platform) => {
    const row = rows?.find((r) => r.platform === platform)
    return {
      platform,
      platform_username: row?.platform_username ?? null,
      connected: !!row,
    }
  })

  return NextResponse.json({ connections })
}
