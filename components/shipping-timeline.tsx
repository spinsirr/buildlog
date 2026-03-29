import { GitBranch, GitMerge, GitPullRequest, Rocket, Tag } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { Post } from '@/lib/types'
import { timeAgo } from '@/lib/utils'

const sourceIcon: Record<string, typeof GitMerge> = {
  pr: GitPullRequest,
  commit: GitMerge,
  release: Rocket,
  tag: Tag,
}

type DayGroup = {
  label: string
  date: string
  posts: Post[]
}

function groupByDay(posts: Post[]): DayGroup[] {
  const days = new Map<string, Post[]>()

  for (const post of posts) {
    const date = new Date(post.created_at).toISOString().slice(0, 10)
    if (!days.has(date)) days.set(date, [])
    days.get(date)!.push(post)
  }

  return Array.from(days.entries()).map(([date, posts]) => {
    const d = new Date(`${date}T12:00:00Z`)
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

    let label: string
    if (date === today) label = 'Today'
    else if (date === yesterday) label = 'Yesterday'
    else
      label = d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })

    return { label, date, posts }
  })
}

function TimelineEntry({ post }: { post: Post }) {
  const Icon = sourceIcon[post.source_type] ?? GitMerge
  const repoName = post.connected_repos?.full_name?.split('/')[1]

  return (
    <div className="group relative flex gap-3 pb-5 last:pb-0">
      {/* Dot + line */}
      <div className="flex flex-col items-center pt-1">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-500 group-hover:border-purple-500/50 group-hover:text-purple-400 transition-colors">
          <Icon className="h-3 w-3" />
        </div>
        <div className="w-px flex-1 bg-zinc-800/50 group-last:hidden" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-200 leading-relaxed line-clamp-2">{post.content}</p>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
          {repoName && <span className="font-mono">{repoName}</span>}
          <span>{timeAgo(post.created_at)}</span>
          <Badge
            variant="secondary"
            className={
              post.status === 'published'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] px-1.5 py-0'
                : 'bg-zinc-800 text-zinc-500 border-0 text-[9px] px-1.5 py-0'
            }
          >
            {post.status}
          </Badge>
        </div>
      </div>
    </div>
  )
}

export function ShippingTimeline({ posts }: { posts: Post[] }) {
  const days = groupByDay(posts)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-zinc-400">Shipping Timeline</h2>
        {posts.length > 0 && (
          <Link
            href="/posts"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            View all
          </Link>
        )}
      </div>

      {posts.length === 0 ? (
        <div className="rounded-lg bg-zinc-900/50 flex flex-col items-center justify-center py-12 gap-3">
          <p className="text-sm text-zinc-400">No shipping activity yet</p>
          <Link
            href="/repos"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-sm font-medium transition-colors"
          >
            <GitBranch className="h-3.5 w-3.5" />
            Connect a repo
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {days.map((day) => (
            <div key={day.date}>
              <div className="mb-3">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                  {day.label}
                </span>
              </div>
              <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/30 p-4">
                {day.posts.map((post) => (
                  <TimelineEntry key={post.id} post={post} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
