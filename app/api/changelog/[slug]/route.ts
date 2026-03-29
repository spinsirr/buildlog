import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createServiceClient()

  // Find the user by changelog slug
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, github_username')
    .eq('changelog_slug', slug)
    .eq('changelog_enabled', true)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Changelog not found' }, { status: 404 })
  }

  // Parse query params
  const url = new URL(req.url)
  const category = url.searchParams.get('category') // filter by category
  const repo = url.searchParams.get('repo') // filter by repo name
  const since = url.searchParams.get('since') // ISO date string
  const until = url.searchParams.get('until') // ISO date string
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200)

  // Build query
  let query = supabase
    .from('posts')
    .select('id, content, change_summary, category, source_type, created_at, published_at, connected_repos(full_name)')
    .eq('user_id', profile.id)
    .in('status', ['published', 'draft'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (category) {
    query = query.eq('category', category)
  }
  if (since) {
    query = query.gte('created_at', since)
  }
  if (until) {
    query = query.lte('created_at', until)
  }

  const { data: posts } = await query

  // Normalize and filter by repo if needed
  const entries = (posts ?? [])
    .map((p) => {
      const repos = Array.isArray(p.connected_repos) ? p.connected_repos[0] : p.connected_repos
      const repoName = (repos as { full_name: string } | null)?.full_name ?? null
      return {
        id: p.id,
        type: p.source_type,
        category: p.category ?? 'improvement',
        summary: p.change_summary ?? p.content,
        social_post: p.content,
        repo: repoName,
        created_at: p.created_at,
        published_at: p.published_at,
      }
    })
    .filter((e) => !repo || e.repo?.includes(repo))

  // Group by week for structured output
  const weeks: Record<string, typeof entries> = {}
  for (const entry of entries) {
    const date = new Date(entry.created_at)
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(date)
    monday.setDate(diff)
    monday.setHours(0, 0, 0, 0)
    const key = monday.toISOString().slice(0, 10)
    if (!weeks[key]) weeks[key] = []
    weeks[key].push(entry)
  }

  const grouped = Object.entries(weeks)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([weekStart, items]) => ({
      week_start: weekStart,
      entries: items,
    }))

  return NextResponse.json({
    changelog: {
      owner: profile.github_username,
      slug,
      generated_at: new Date().toISOString(),
      total_entries: entries.length,
    },
    weeks: grouped,
    // Flat list for agents that just want a simple array
    entries,
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
