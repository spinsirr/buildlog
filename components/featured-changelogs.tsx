import { ArrowRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { timeAgo } from '@/lib/utils'

type FeaturedEntry = {
  userId: string
  username: string
  avatarUrl: string | null
  postCount: number
  lastPublishedAt: string
}

async function getFeatured(limit: number): Promise<FeaturedEntry[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('posts')
    .select(
      'user_id, published_at, profiles!inner(github_username, github_avatar_url, public_changelog)'
    )
    .eq('status', 'published')
    .eq('profiles.public_changelog', true)
    .order('published_at', { ascending: false })
    .limit(500)

  if (error || !data) return []

  const byUser = new Map<string, FeaturedEntry>()
  for (const row of data) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    if (!profile?.github_username || !row.published_at) continue

    const existing = byUser.get(row.user_id)
    if (existing) {
      existing.postCount++
    } else {
      byUser.set(row.user_id, {
        userId: row.user_id,
        username: profile.github_username,
        avatarUrl: profile.github_avatar_url,
        postCount: 1,
        lastPublishedAt: row.published_at,
      })
    }
  }

  return Array.from(byUser.values()).slice(0, limit)
}

const ACCENTS = [
  'bg-neo-secondary',
  'bg-neo-lime',
  'bg-neo-accent',
  'bg-neo-muted',
  'bg-neo-mint',
  'bg-neo-secondary',
] as const

export async function FeaturedChangelogs() {
  const entries = await getFeatured(6)

  // Don't render the section if we have nothing to show — landing should
  // still look great without featured users.
  if (entries.length === 0) return null

  return (
    <section
      aria-labelledby="featured-changelogs-heading"
      className="border-t-4 border-black py-20 md:py-24 px-6 bg-neo-cream"
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14">
          <div>
            <div
              className="inline-flex border-2 border-black px-4 py-1.5 mb-6 rotate-1 bg-neo-lime"
              style={{ boxShadow: '3px 3px 0 0 #000000' }}
            >
              <span className="font-mono-ui text-xs font-bold uppercase tracking-[0.2em]">
                ✦ In the wild
              </span>
            </div>
            <h2
              id="featured-changelogs-heading"
              className="font-display font-black uppercase leading-tight"
              style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}
            >
              Real devs.
              <br />
              Real shipping.
            </h2>
          </div>
          <Link
            href="/changelog"
            className="inline-flex items-center gap-2 border-4 border-black px-5 py-3 bg-neo-cream font-mono-ui text-sm font-bold uppercase tracking-wider text-black neo-btn-sm self-start md:self-end focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          >
            See all changelogs <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {entries.map((entry, i) => (
            <li key={entry.userId}>
              <Link
                href={`/changelog/${entry.username}`}
                className="group block border-4 border-black bg-neo-cream neo-card p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
              >
                <div className="flex items-center gap-4 mb-5">
                  {entry.avatarUrl ? (
                    <div className="border-2 border-black shrink-0">
                      <Image
                        src={entry.avatarUrl}
                        alt={`${entry.username} avatar`}
                        width={48}
                        height={48}
                        className="block"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div
                      className={`border-2 border-black w-12 h-12 flex items-center justify-center shrink-0 ${ACCENTS[i % ACCENTS.length]}`}
                      aria-hidden="true"
                    >
                      <span className="font-display font-black text-xl">
                        {entry.username[0]?.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-lg truncate">{entry.username}</p>
                    <p className="font-mono-ui text-[11px] uppercase tracking-wider opacity-60">
                      last shipped {timeAgo(entry.lastPublishedAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-end justify-between">
                  <div
                    className={`inline-flex border-2 border-black px-2.5 py-1 ${ACCENTS[i % ACCENTS.length]}`}
                  >
                    <span className="font-mono-ui text-xs font-bold uppercase tracking-wider text-black">
                      {entry.postCount} post{entry.postCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono-ui text-xs font-bold uppercase tracking-wider transition-transform group-hover:translate-x-0.5">
                    view <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
