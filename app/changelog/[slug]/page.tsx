import { ExternalLink, GitCommit, GitMerge, PenLine, Tag } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LogoMark } from '@/components/logo-mark'
import { Badge } from '@/components/ui/badge'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// ─── Types ───────────────────────────────────────────────────────────────────

type ChangelogPost = {
  id: string
  content: string
  source_type: string
  published_at: string
  platform_post_url: string | null
  connected_repos: { full_name: string } | null
}

type GroupedPosts = {
  date: string
  label: string
  posts: ChangelogPost[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SOURCE_TYPE_CONFIG: Record<
  string,
  { label: string; Icon: typeof GitCommit; className: string }
> = {
  commit: {
    label: 'Commit',
    Icon: GitCommit,
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  pr: {
    label: 'Pull Request',
    Icon: GitMerge,
    className: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  release: {
    label: 'Release',
    Icon: Tag,
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  manual: {
    label: 'Post',
    Icon: PenLine,
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatDateKey(dateString: string): string {
  return new Date(dateString).toISOString().split('T')[0]
}

function groupPostsByDate(posts: ChangelogPost[]): GroupedPosts[] {
  const groups = new Map<string, ChangelogPost[]>()

  for (const post of posts) {
    const key = formatDateKey(post.published_at)
    const existing = groups.get(key)
    if (existing) {
      existing.push(post)
    } else {
      groups.set(key, [post])
    }
  }

  return Array.from(groups.entries()).map(([date, datePosts]) => ({
    date,
    label: formatDate(datePosts[0].published_at),
    posts: datePosts,
  }))
}

// ─── Data fetching ───────────────────────────────────────────────────────────

async function getProfileByUsername(username: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, github_username, github_avatar_url')
    .eq('github_username', username)
    .single()

  if (error || !data) return null
  return data
}

async function getPublishedPosts(userId: string): Promise<ChangelogPost[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('posts')
    .select('id, content, source_type, published_at, platform_post_url, connected_repos(full_name)')
    .eq('user_id', userId)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(100)

  if (error || !data) return []
  return data.map((row) => ({
    ...row,
    connected_repos: Array.isArray(row.connected_repos)
      ? (row.connected_repos[0] ?? null)
      : row.connected_repos,
  })) as ChangelogPost[]
}

// ─── SEO Metadata ────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const profile = await getProfileByUsername(slug)

  if (!profile) {
    return { title: 'User Not Found' }
  }

  const title = `${profile.github_username}'s Changelog`
  const description = `See what ${profile.github_username} has been shipping — commits, pull requests, releases, and more.`

  return {
    title,
    description,
    openGraph: {
      type: 'profile',
      title,
      description,
      url: `https://buildlog.ink/changelog/${profile.github_username}`,
      ...(profile.github_avatar_url && {
        images: [{ url: profile.github_avatar_url, width: 256, height: 256 }],
      }),
    },
    twitter: {
      card: 'summary',
      title,
      description,
      ...(profile.github_avatar_url && { images: [profile.github_avatar_url] }),
    },
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function ChangelogPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const profile = await getProfileByUsername(slug)

  if (!profile) {
    notFound()
  }

  const posts = await getPublishedPosts(profile.id)
  const grouped = groupPostsByDate(posts)

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogoMark size={20} />
            <span className="text-sm font-medium">BuildLog</span>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Profile header */}
        <div className="flex items-center gap-4 mb-12">
          {profile.github_avatar_url ? (
            <Image
              src={profile.github_avatar_url}
              alt={`${profile.github_username}'s avatar`}
              width={64}
              height={64}
              className="rounded-full border-2 border-border"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xl font-bold">
              {profile.github_username?.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{profile.github_username}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Changelog &middot; {posts.length} {posts.length === 1 ? 'post' : 'posts'}
            </p>
          </div>
        </div>

        {/* Posts */}
        {posts.length === 0 ? (
          <div className="text-center py-24">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
              <PenLine className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">No posts yet</p>
          </div>
        ) : (
          <div className="space-y-12">
            {grouped.map((group) => (
              <section key={group.date}>
                {/* Date header */}
                <div className="flex items-center gap-3 mb-6">
                  <time dateTime={group.date} className="text-sm font-medium text-muted-foreground">
                    {group.label}
                  </time>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Posts for this date */}
                <div className="space-y-4">
                  {group.posts.map((post) => {
                    const config = SOURCE_TYPE_CONFIG[post.source_type] ?? SOURCE_TYPE_CONFIG.manual
                    const { Icon } = config

                    return (
                      <article
                        key={post.id}
                        className="group rounded-lg border border-border bg-card p-5 transition-colors hover:bg-accent/50"
                      >
                        {/* Meta row */}
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <Badge className={`${config.className} text-[11px] gap-1`}>
                            <Icon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                          {post.connected_repos?.full_name && (
                            <span className="text-xs text-muted-foreground font-mono">
                              {post.connected_repos.full_name}
                            </span>
                          )}
                        </div>

                        {/* Content */}
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {post.content}
                        </p>

                        {/* Footer */}
                        {post.platform_post_url && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <a
                              href={post.platform_post_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              View post
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-16">
        <div className="max-w-3xl mx-auto px-6 py-8 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogoMark size={16} />
            <span className="text-xs font-medium">Powered by BuildLog</span>
          </Link>
          <span className="text-xs text-muted-foreground">buildlog.ink</span>
        </div>
      </footer>
    </div>
  )
}
