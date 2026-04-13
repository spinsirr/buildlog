import type { MetadataRoute } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const BASE_URL = 'https://buildlog.ink'

async function getChangelogEntries(): Promise<MetadataRoute.Sitemap> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('posts')
      .select(
        'user_id, published_at, profiles!inner(github_username, public_changelog)'
      )
      .eq('status', 'published')
      .eq('profiles.public_changelog', true)
      .order('published_at', { ascending: false })
      .limit(5000)

    if (error || !data) return []

    // Aggregate by user — keep earliest (latest) publish date per user.
    type Row = {
      user_id: string
      published_at: string | null
      profiles: { github_username: string | null; public_changelog: boolean }
        | { github_username: string | null; public_changelog: boolean }[]
    }
    const byUser = new Map<string, { username: string; lastModified: Date }>()
    for (const row of data as Row[]) {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      if (!profile?.github_username || !row.published_at) continue
      if (byUser.has(row.user_id)) continue // first occurrence is newest (order DESC)
      byUser.set(row.user_id, {
        username: profile.github_username,
        lastModified: new Date(row.published_at),
      })
    }

    return Array.from(byUser.values()).map(({ username, lastModified }) => ({
      url: `${BASE_URL}/changelog/${username}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/examples`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/changelog`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  const changelogEntries = await getChangelogEntries()
  return [...staticEntries, ...changelogEntries]
}
