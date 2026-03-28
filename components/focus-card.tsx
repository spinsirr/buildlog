'use client'

import { ArrowRight, FileText, GitFork, Share2, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type FocusAction =
  | { type: 'connect-repo' }
  | { type: 'connect-platform' }
  | { type: 'review-drafts'; count: number }
  | { type: 'all-clear' }

function getFocusAction({
  hasRepos,
  hasSocial,
  draftCount,
}: {
  hasRepos: boolean
  hasSocial: boolean
  draftCount: number
}): FocusAction {
  if (!hasRepos) return { type: 'connect-repo' }
  if (!hasSocial) return { type: 'connect-platform' }
  if (draftCount > 0) return { type: 'review-drafts', count: draftCount }
  return { type: 'all-clear' }
}

const config: Record<
  FocusAction['type'],
  {
    icon: React.ReactNode
    heading: string | ((a: FocusAction) => string)
    sub: string
    href: string
    cta: string
    accent: string
    bg: string
  }
> = {
  'connect-repo': {
    icon: <GitFork className="h-5 w-5" />,
    heading: 'Connect a repo to get started',
    sub: 'BuildLog watches your commits and generates posts automatically.',
    href: '/repos',
    cta: 'Connect repo',
    accent: 'text-purple-400',
    bg: 'bg-purple-500/5 border-purple-500/20',
  },
  'connect-platform': {
    icon: <Share2 className="h-5 w-5" />,
    heading: 'Connect a platform to publish',
    sub: 'Link Twitter, LinkedIn, or Bluesky so your posts go live.',
    href: '/settings',
    cta: 'Connect platform',
    accent: 'text-purple-400',
    bg: 'bg-purple-500/5 border-purple-500/20',
  },
  'review-drafts': {
    icon: <FileText className="h-5 w-5" />,
    heading: (a) =>
      `${(a as { count: number }).count} draft${(a as { count: number }).count === 1 ? '' : 's'} waiting for you`,
    sub: 'Review and publish your AI-generated posts.',
    href: '/posts',
    cta: 'Review drafts',
    accent: 'text-amber-400',
    bg: 'bg-amber-500/5 border-amber-500/20',
  },
  'all-clear': {
    icon: <Sparkles className="h-5 w-5" />,
    heading: 'All caught up',
    sub: 'No drafts waiting. Write something new or keep shipping.',
    href: '/posts',
    cta: 'Write a post',
    accent: 'text-emerald-400',
    bg: 'bg-emerald-500/5 border-emerald-500/20',
  },
}

export function FocusCard({
  hasRepos,
  hasSocial,
  draftCount,
}: {
  hasRepos: boolean
  hasSocial: boolean
  draftCount: number
}) {
  const action = getFocusAction({ hasRepos, hasSocial, draftCount })
  const c = config[action.type]
  const heading = typeof c.heading === 'function' ? c.heading(action) : c.heading

  return (
    <Link
      href={c.href}
      className={cn(
        'group flex items-center gap-4 rounded-xl border p-5 transition-colors hover:bg-zinc-800/30',
        c.bg
      )}
    >
      <div className={cn('shrink-0', c.accent)}>{c.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-base font-medium text-zinc-100">{heading}</p>
        <p className="text-sm text-zinc-400 mt-0.5">{c.sub}</p>
      </div>
      <div
        className={cn(
          'shrink-0 flex items-center gap-1.5 text-sm font-medium transition-transform group-hover:translate-x-0.5',
          c.accent
        )}
      >
        {c.cta}
        <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </Link>
  )
}
