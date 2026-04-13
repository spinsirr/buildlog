import { ArrowRight, Star } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { LandingNav } from '@/components/landing-nav'
import { LogoMark } from '@/components/logo-mark'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { timeAgo } from '@/lib/utils'

// ─── SEO ──────────────────────────────────────────────────────────────────────
const SITE_URL = 'https://buildlog.ink'

export const metadata: Metadata = {
  title: 'Changelogs — Devs shipping in public',
  description:
    'Browse public build-in-public timelines from developers using BuildLog. Real commits, real products, real progress.',
  alternates: { canonical: '/changelog' },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/changelog`,
    siteName: 'BuildLog',
    title: 'Changelogs — Devs shipping in public',
    description: 'Browse public build-in-public timelines from developers using BuildLog.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Changelogs — Devs shipping in public',
    description: 'Real devs. Real products. Real progress.',
  },
}

// ─── Types ────────────────────────────────────────────────────────────────────
type DirectoryEntry = {
  userId: string
  username: string
  avatarUrl: string | null
  postCount: number
  lastPublishedAt: string
}

// ─── Data ─────────────────────────────────────────────────────────────────────
async function getDirectoryEntries(): Promise<DirectoryEntry[]> {
  const supabase = await createServerSupabaseClient()

  // Pull recent published posts with profile join. RLS allows public reads of
  // published posts + public profiles; the inner join filters out profiles
  // that have opted out of the directory.
  const { data, error } = await supabase
    .from('posts')
    .select(
      'user_id, published_at, profiles!inner(github_username, github_avatar_url, public_changelog)'
    )
    .eq('status', 'published')
    .eq('profiles.public_changelog', true)
    .order('published_at', { ascending: false })
    .limit(1000)

  if (error || !data) return []

  // Aggregate by user — the first row per user is their latest post
  // (query is already ordered by published_at DESC).
  const byUser = new Map<string, DirectoryEntry>()
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

  return Array.from(byUser.values())
}

// ─── JSON-LD ──────────────────────────────────────────────────────────────────
// Escape `<` to prevent any `</script>` injection in inline script content.
// GitHub usernames are alphanumeric + hyphen only, but belt-and-suspenders.
function buildJsonLdSafe(entries: DirectoryEntry[]): string {
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'BuildLog Changelogs',
    description: 'Public build-in-public timelines from developers using BuildLog.',
    url: `${SITE_URL}/changelog`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: entries.length,
      itemListElement: entries.slice(0, 50).map((entry, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}/changelog/${entry.username}`,
        name: `${entry.username}'s Changelog`,
      })),
    },
  }
  return JSON.stringify(payload).replace(/</g, '\\u003c')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ACCENT_PALETTE = [
  'bg-neo-secondary',
  'bg-neo-accent',
  'bg-neo-lime',
  'bg-neo-muted',
  'bg-neo-mint',
] as const

function GridOverlay({ opacity = '08' }: { opacity?: string }) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      aria-hidden="true"
      style={{
        backgroundImage: `linear-gradient(#000000${opacity} 1px, transparent 1px), linear-gradient(90deg, #000000${opacity} 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
      }}
    />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function ChangelogDirectoryPage() {
  const entries = await getDirectoryEntries()
  const jsonLd = buildJsonLdSafe(entries)

  return (
    <div className="min-h-screen antialiased bg-neo-cream text-black">
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires inline script, content is JSON.stringify'd server-side with < escaped */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <LandingNav />

      <main id="main-content">
        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section
          aria-labelledby="directory-heading"
          className="relative py-20 md:py-28 px-6 overflow-hidden"
        >
          <GridOverlay />

          <div className="max-w-5xl mx-auto relative text-center">
            <div className="mb-8">
              <div
                className="inline-flex border-2 border-black px-4 py-1.5 -rotate-1 bg-neo-lime"
                style={{ boxShadow: '3px 3px 0 0 #000000' }}
              >
                <span className="font-mono-ui text-xs font-bold uppercase tracking-[0.2em]">
                  ✦ {entries.length} dev{entries.length === 1 ? '' : 's'} shipping in public
                </span>
              </div>
            </div>

            <h1
              id="directory-heading"
              className="font-display font-black uppercase tracking-tight leading-none mb-6"
              style={{ fontSize: 'clamp(40px, 7vw, 72px)' }}
            >
              Real devs.
              <br />
              <span
                className="inline-block border-4 border-black px-3 rotate-1 bg-neo-accent"
                style={{ boxShadow: '6px 6px 0 0 #000000' }}
              >
                Real changelogs.
              </span>
            </h1>

            <p className="font-mono-ui text-base md:text-lg max-w-lg mx-auto leading-relaxed opacity-70">
              Every page below is a live build-in-public timeline. Code changes in, ready-to-publish
              posts out. This is what BuildLog looks like in the wild.
            </p>
          </div>
        </section>

        {/* ── DIRECTORY ─────────────────────────────────────────────────── */}
        <section
          aria-label="Changelog directory"
          className="border-t-4 border-black py-16 px-6 relative"
        >
          <GridOverlay opacity="04" />

          <div className="max-w-6xl mx-auto relative">
            {entries.length === 0 ? (
              <EmptyState />
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {entries.map((entry, i) => (
                  <li key={entry.userId}>
                    <DirectoryCard
                      entry={entry}
                      accent={ACCENT_PALETTE[i % ACCENT_PALETTE.length]}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────── */}
        <section className="border-t-4 border-black py-20 px-6 relative overflow-hidden bg-neo-secondary">
          <GridOverlay opacity="06" />

          <div className="absolute top-8 right-8 hidden lg:block opacity-30" aria-hidden="true">
            <Star
              className="h-10 w-10 animate-spin-slow"
              fill="#000000"
              stroke="#000000"
              strokeWidth={1}
            />
          </div>

          <div className="max-w-3xl mx-auto text-center relative">
            <h2
              className="font-display font-black uppercase leading-tight mb-6 text-black"
              style={{ fontSize: 'clamp(36px, 7vw, 64px)' }}
            >
              Get your own.
            </h2>
            <p className="font-mono-ui text-sm md:text-base max-w-md mx-auto mb-10 leading-relaxed opacity-70 text-black">
              Connect your GitHub and start a public changelog. Every push becomes a post.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-3 border-4 border-black px-10 py-5 bg-black font-mono-ui text-base font-bold uppercase tracking-wider text-white neo-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            >
              Start shipping in public <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer className="border-t-4 border-black py-8 px-6 bg-neo-cream">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoMark size={24} />
            <span className="font-display font-bold text-lg tracking-tight">buildlog</span>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/privacy"
              className="font-mono-ui text-xs font-bold uppercase tracking-widest opacity-40 hover:opacity-70"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="font-mono-ui text-xs font-bold uppercase tracking-widest opacity-40 hover:opacity-70"
            >
              Terms
            </Link>
            <span className="font-mono-ui text-xs font-bold uppercase tracking-widest opacity-40">
              © {new Date().getFullYear()} buildlog
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function DirectoryCard({
  entry,
  accent,
}: {
  entry: DirectoryEntry
  accent: (typeof ACCENT_PALETTE)[number]
}) {
  return (
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
            className={`border-2 border-black w-12 h-12 flex items-center justify-center shrink-0 ${accent}`}
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
        <div className={`inline-flex border-2 border-black px-2.5 py-1 ${accent}`}>
          <span className="font-mono-ui text-xs font-bold uppercase tracking-wider text-black">
            {entry.postCount} post{entry.postCount === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-mono-ui text-xs font-bold uppercase tracking-wider transition-transform group-hover:translate-x-0.5">
          view <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </div>
      </div>
    </Link>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="border-4 border-black bg-neo-cream p-12 text-center neo-card">
      <div
        className="inline-flex border-2 border-black px-4 py-1.5 mb-6 rotate-1 bg-neo-lime"
        style={{ boxShadow: '3px 3px 0 0 #000000' }}
      >
        <span className="font-mono-ui text-xs font-bold uppercase tracking-[0.2em]">
          ✦ Be the first
        </span>
      </div>
      <h2 className="font-display font-black uppercase text-2xl md:text-3xl tracking-tight mb-4">
        No changelogs yet.
      </h2>
      <p className="font-mono-ui text-sm max-w-md mx-auto mb-8 opacity-70">
        Nobody has a public changelog here yet. Connect your GitHub, ship something, publish a post
        — you&apos;ll be the first one on this page.
      </p>
      <Link
        href="/login"
        className="inline-flex items-center gap-2 border-4 border-black px-6 py-3 bg-neo-accent font-mono-ui text-sm font-bold uppercase tracking-wider text-black neo-btn"
      >
        Start shipping <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  )
}
