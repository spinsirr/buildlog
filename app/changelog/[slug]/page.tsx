import { Bug, Code, GitMerge, GitPullRequest, Rocket, Sparkles, Tag, Wrench, FileText } from 'lucide-react'
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
  change_summary: string | null
  category: string | null
  source_type: string
  source_data: Record<string, unknown> | null
  created_at: string
  connected_repos: { full_name: string } | null
}

type CategoryGroup = {
  category: string
  label: string
  posts: ChangelogPost[]
}

type WeekGroup = {
  label: string
  startDate: string
  categories: CategoryGroup[]
  postCount: number
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

  const [{ data: posts }, { data: digests }] = await Promise.all([
    supabase
      .from('posts')
      .select(
        'id, content, change_summary, category, source_type, source_data, created_at, connected_repos(full_name)',
      )
      .eq('user_id', profile.id)
      .in('status', ['published', 'draft'])
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('weekly_digests')
      .select('week_start, summary, post_count')
      .eq('user_id', profile.id)
      .order('week_start', { ascending: false })
      .limit(20),
  ])

  const digestMap = new Map<string, string>()
  for (const d of digests ?? []) {
    digestMap.set(d.week_start, d.summary)
  }

  return {
    profile,
    digestMap,
    posts: (posts ?? []).map((p) => ({
      ...p,
      connected_repos: Array.isArray(p.connected_repos)
        ? (p.connected_repos[0] ?? null)
        : p.connected_repos,
    })) as ChangelogPost[],
  }
}

const categoryOrder = ['feature', 'fix', 'improvement', 'infra', 'docs']
const categoryLabels: Record<string, string> = {
  feature: 'New Features',
  fix: 'Bug Fixes',
  improvement: 'Improvements',
  infra: 'Infrastructure',
  docs: 'Documentation',
}

function groupByWeek(posts: ChangelogPost[]): WeekGroup[] {
  const weeks = new Map<string, ChangelogPost[]>()

  for (const post of posts) {
    const date = new Date(post.created_at)
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(date)
    monday.setDate(diff)
    monday.setHours(0, 0, 0, 0)
    const key = monday.toISOString().slice(0, 10)

    if (!weeks.has(key)) weeks.set(key, [])
    weeks.get(key)!.push(post)
  }

  return Array.from(weeks.entries()).map(([startDate, weekPosts]) => {
    const start = new Date(startDate)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)

    const fmt = (d: Date) =>
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    // Group posts by category within each week
    const catMap = new Map<string, ChangelogPost[]>()
    for (const post of weekPosts) {
      const cat = post.category ?? 'improvement'
      if (!catMap.has(cat)) catMap.set(cat, [])
      catMap.get(cat)!.push(post)
    }

    const categories = categoryOrder
      .filter((cat) => catMap.has(cat))
      .map((cat) => ({
        category: cat,
        label: categoryLabels[cat] ?? cat,
        posts: catMap.get(cat)!,
      }))

    // Add any categories not in the predefined order
    for (const [cat, catPosts] of catMap) {
      if (!categoryOrder.includes(cat)) {
        categories.push({
          category: cat,
          label: categoryLabels[cat] ?? cat,
          posts: catPosts,
        })
      }
    }

    return {
      label: `${fmt(start)} — ${fmt(end)}, ${start.getFullYear()}`,
      startDate,
      categories,
      postCount: weekPosts.length,
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
    title: `${name} — Changelog`,
    description: `See what ${name} shipped recently — auto-generated from GitHub activity.`,
    openGraph: {
      title: `${name} — Changelog`,
      description: `See what ${name} shipped recently.`,
    },
  }
}

// --- Components --------------------------------------------------------------

const categoryIcon: Record<string, typeof Sparkles> = {
  feature: Sparkles,
  fix: Bug,
  improvement: Wrench,
  infra: Code,
  docs: FileText,
}

const categoryColor: Record<string, string> = {
  feature: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  fix: 'text-red-400 border-red-500/30 bg-red-500/10',
  improvement: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  infra: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  docs: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
}

const sourceIcon: Record<string, typeof GitMerge> = {
  pr: GitPullRequest,
  commit: GitMerge,
  release: Rocket,
  tag: Tag,
}

function PostEntry({ post }: { post: ChangelogPost }) {
  const SourceIcon = sourceIcon[post.source_type] ?? GitMerge
  const date = new Date(post.created_at)
  const repoName = post.connected_repos?.full_name?.split('/')[1]
  const displayText = post.change_summary ?? post.content

  return (
    <li className="group flex gap-3 py-2">
      <SourceIcon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-300 leading-relaxed">{displayText}</p>
        <div className="mt-1 flex items-center gap-3 text-xs text-zinc-600">
          <time dateTime={date.toISOString()}>
            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </time>
          {repoName && <span className="font-mono">{repoName}</span>}
        </div>
      </div>
    </li>
  )
}

function CategorySection({ group }: { group: CategoryGroup }) {
  const Icon = categoryIcon[group.category] ?? Wrench
  const color = categoryColor[group.category] ?? 'text-zinc-400 border-zinc-500/30 bg-zinc-500/10'

  return (
    <div className="mb-6 last:mb-0">
      <div className="mb-3 flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${color}`}>
          <Icon className="h-3 w-3" />
          {group.label}
        </span>
        <span className="text-xs text-zinc-700">{group.posts.length}</span>
      </div>
      <ul className="space-y-1 border-l border-zinc-800/50 pl-4">
        {group.posts.map((post) => (
          <PostEntry key={post.id} post={post} />
        ))}
      </ul>
    </div>
  )
}

function WeekSection({ week, digest }: { week: WeekGroup; digest?: string }) {
  return (
    <section className="relative">
      <div className="sticky top-0 z-10 -mx-1 mb-6 bg-zinc-950/80 px-1 py-3 backdrop-blur-sm border-b border-zinc-800/30">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">{week.label}</h2>
          <span className="font-mono text-xs text-zinc-600">
            {week.postCount} update{week.postCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      {digest && (
        <div className="mb-6 rounded-lg border border-zinc-800/50 bg-zinc-900/30 p-4">
          <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Summary
          </p>
          <div className="text-sm leading-relaxed text-zinc-400 whitespace-pre-line">{digest}</div>
        </div>
      )}
      <div>
        {week.categories.map((group) => (
          <CategorySection key={group.category} group={group} />
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

  const { profile, posts, digestMap } = data
  const weeks = groupByWeek(posts)
  const username = profile.github_username ?? slug

  // Stats
  const totalPosts = posts.length
  const categories = new Set(posts.map((p) => p.category ?? 'improvement'))
  const repos = new Set(posts.map((p) => p.connected_repos?.full_name).filter(Boolean))

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800/50">
        <div className="mx-auto max-w-2xl px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {profile.github_avatar_url ? (
                <Image
                  src={profile.github_avatar_url}
                  alt={username}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full ring-1 ring-zinc-800"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-zinc-800" />
              )}
              <div>
                <h1 className="text-base font-semibold">{username}</h1>
                <p className="text-xs text-zinc-500">Changelog</p>
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

          {/* Stats bar */}
          <div className="mt-5 flex items-center gap-6 text-xs text-zinc-500">
            <span>
              <span className="font-mono text-zinc-300">{totalPosts}</span> updates
            </span>
            <span>
              <span className="font-mono text-zinc-300">{repos.size}</span> repo{repos.size !== 1 ? 's' : ''}
            </span>
            <span>
              <span className="font-mono text-zinc-300">{weeks.length}</span> week{weeks.length !== 1 ? 's' : ''}
            </span>
            {/* Agent API link */}
            <a
              href={`/api/changelog/${slug}`}
              className="ml-auto font-mono text-zinc-600 hover:text-zinc-400 transition-colors"
              title="JSON API for agents"
            >
              /api/json
            </a>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-2xl px-6 py-10">
        {weeks.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-zinc-500">No shipping activity yet.</p>
          </div>
        ) : (
          <div className="space-y-14">
            {weeks.map((week) => (
              <WeekSection
                key={week.startDate}
                week={week}
                digest={digestMap.get(week.startDate)}
              />
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
