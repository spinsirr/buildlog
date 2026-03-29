import { GitMerge, GitPullRequest, Rocket, Tag } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LogoMark } from '@/components/logo-mark'
import { createServiceClient } from '@/lib/supabase/service'

// --- Types -------------------------------------------------------------------

type ChangelogPost = {
  id: string
  content: string
  source_type: string
  source_data: Record<string, unknown> | null
  created_at: string
  connected_repos: { full_name: string } | null
}

type WeekGroup = {
  label: string
  startDate: string
  posts: ChangelogPost[]
}

// --- Data fetching -----------------------------------------------------------

async function getChangelog(slug: string) {
  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, github_username, github_avatar_url, changelog_enabled')
    .eq('changelog_slug', slug)
    .eq('changelog_enabled', true)
    .single()

  if (!profile) return null

  const { data: posts } = await supabase
    .from('posts')
    .select('id, content, source_type, source_data, created_at, connected_repos(full_name)')
    .eq('user_id', profile.id)
    .in('status', ['published', 'draft'])
    .order('created_at', { ascending: false })
    .limit(100)

  return {
    profile,
    posts: (posts ?? []).map((p) => ({
      ...p,
      connected_repos: Array.isArray(p.connected_repos)
        ? (p.connected_repos[0] ?? null)
        : p.connected_repos,
    })) as ChangelogPost[],
  }
}

function groupByWeek(posts: ChangelogPost[]): WeekGroup[] {
  const weeks = new Map<string, ChangelogPost[]>()

  for (const post of posts) {
    const date = new Date(post.created_at)
    // Get Monday of the week
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(date)
    monday.setDate(diff)
    monday.setHours(0, 0, 0, 0)
    const key = monday.toISOString().slice(0, 10)

    if (!weeks.has(key)) weeks.set(key, [])
    weeks.get(key)!.push(post)
  }

  return Array.from(weeks.entries()).map(([startDate, posts]) => {
    const start = new Date(startDate)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)

    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    return {
      label: `${fmt(start)} — ${fmt(end)}, ${start.getFullYear()}`,
      startDate,
      posts,
    }
  })
}

// --- Metadata ----------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const data = await getChangelog(slug)
  if (!data) return { title: 'Not Found' }

  const name = data.profile.github_username ?? slug
  return {
    title: `${name}'s Changelog`,
    description: `See what ${name} shipped recently — auto-generated from GitHub activity.`,
    openGraph: {
      title: `${name}'s Changelog — BuildLog`,
      description: `See what ${name} shipped recently.`,
    },
  }
}

// --- Components --------------------------------------------------------------

const sourceIcon: Record<string, typeof GitMerge> = {
  pr: GitPullRequest,
  commit: GitMerge,
  release: Rocket,
  tag: Tag,
}

function PostEntry({ post }: { post: ChangelogPost }) {
  const Icon = sourceIcon[post.source_type] ?? GitMerge
  const date = new Date(post.created_at)
  const repoName = post.connected_repos?.full_name?.split('/')[1]

  return (
    <div className="group relative flex gap-4 pb-8 last:pb-0">
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-zinc-700 bg-zinc-900 text-zinc-400 group-hover:border-purple-500 group-hover:text-purple-400 transition-colors">
          <Icon className="h-4 w-4" />
        </div>
        <div className="w-px flex-1 bg-zinc-800 group-last:hidden" />
      </div>

      {/* Content */}
      <div className="flex-1 pt-0.5">
        <p className="text-sm text-zinc-200 leading-relaxed">{post.content}</p>
        <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
          <time dateTime={date.toISOString()}>
            {date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </time>
          {repoName && <span className="font-mono text-zinc-600">{repoName}</span>}
          <span className="capitalize text-zinc-600">{post.source_type}</span>
        </div>
      </div>
    </div>
  )
}

function WeekSection({ week }: { week: WeekGroup }) {
  return (
    <section className="relative">
      <div className="sticky top-0 z-10 -mx-1 mb-6 bg-zinc-950/80 px-1 py-3 backdrop-blur-sm">
        <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-500">
          {week.label}
          <span className="ml-3 text-zinc-700">
            {week.posts.length} update{week.posts.length !== 1 ? 's' : ''}
          </span>
        </h2>
      </div>
      <div>
        {week.posts.map((post) => (
          <PostEntry key={post.id} post={post} />
        ))}
      </div>
    </section>
  )
}

// --- Page --------------------------------------------------------------------

export default async function ChangelogPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await getChangelog(slug)
  if (!data) notFound()

  const { profile, posts } = data
  const weeks = groupByWeek(posts)
  const username = profile.github_username ?? slug

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800/50">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            {profile.github_avatar_url ? (
              <Image
                src={profile.github_avatar_url}
                alt={username}
                width={32}
                height={32}
                className="h-8 w-8 rounded-full ring-1 ring-zinc-800"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-zinc-800" />
            )}
            <div>
              <h1 className="text-sm font-semibold">{username}</h1>
              <p className="text-xs text-zinc-500">Shipping log</p>
            </div>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <LogoMark size={16} />
            <span className="font-mono">buildlog</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-2xl px-6 py-10">
        {weeks.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-zinc-500">No shipping activity yet.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {weeks.map((week) => (
              <WeekSection key={week.startDate} week={week} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 py-8">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <LogoMark size={14} />
            <span>Powered by BuildLog — see what your team ships</span>
          </Link>
        </div>
      </footer>
    </div>
  )
}
