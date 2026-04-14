'use client'

import { ChevronDown, GitBranch } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { DashboardActions } from '@/components/dashboard-actions'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { platformLabels } from '@/lib/platforms'
import type { Post } from '@/lib/types'
import { cn, draftAgeBucket, draftAgeText, timeAgo } from '@/lib/utils'

function PostRow({ post }: { post: Post }) {
  return (
    <TableRow className="border-zinc-800 hover:bg-zinc-800/30">
      <TableCell className="max-w-xs">
        <p className="text-sm text-zinc-300 line-clamp-2">{post.content}</p>
        {post.connected_repos && (
          <span className="text-xs text-zinc-500 font-mono-ui">
            {post.connected_repos.full_name}
          </span>
        )}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <div className="flex gap-1">
          {post.platforms?.length ? (
            post.platforms.map((p: string) => (
              <Badge
                key={p}
                variant="secondary"
                className="bg-zinc-800 text-zinc-400 text-[10px] border-0"
              >
                {platformLabels[p] ?? p}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-zinc-500">--</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge
          variant={post.status === 'published' ? 'default' : 'secondary'}
          className={cn(
            'text-[10px] rounded-none font-bold font-mono-ui uppercase',
            post.status === 'published'
              ? 'bg-neo-mint/10 text-neo-mint border-neo-mint/20'
              : 'bg-zinc-800 text-zinc-400 border-0'
          )}
        >
          {post.status}
        </Badge>
      </TableCell>
      <TableCell className="hidden md:table-cell text-xs font-mono-ui">
        <span
          className={cn(
            post.status === 'draft'
              ? {
                  fresh: 'text-zinc-500',
                  aging: 'text-amber-400/70',
                  stale: 'text-red-400/70',
                }[draftAgeBucket(post.created_at)]
              : 'text-zinc-500'
          )}
        >
          {post.status === 'draft' ? draftAgeText(post.created_at) : timeAgo(post.created_at)}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <DashboardActions postId={post.id} />
      </TableCell>
    </TableRow>
  )
}

export function DashboardPostsTable({ posts }: { posts: Post[] }) {
  const [lowOpen, setLowOpen] = useState(false)
  const highSignal = posts.filter((p) => p.signal !== 'low')
  const lowSignal = posts.filter((p) => p.signal === 'low')

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold font-mono-ui uppercase tracking-widest text-zinc-500">
          Recent Posts
        </h2>
        {posts.length > 0 && (
          <Link
            href="/posts"
            className="text-xs font-bold font-mono-ui uppercase tracking-wider text-neo-accent hover:text-neo-accent/80 transition-colors"
          >
            View all
          </Link>
        )}
      </div>
      <div className="rounded-none border-2 border-zinc-800 bg-zinc-900/50 overflow-x-auto">
        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <p className="text-sm text-zinc-400">No posts yet</p>
            <Link
              href="/repos"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-sm font-medium transition-colors"
            >
              <GitBranch className="h-3.5 w-3.5" />
              Connect a repo
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-500">Post</TableHead>
                <TableHead className="hidden md:table-cell text-zinc-500">Platforms</TableHead>
                <TableHead className="text-zinc-500">Status</TableHead>
                <TableHead className="hidden md:table-cell text-zinc-500">Date</TableHead>
                <TableHead className="text-zinc-500 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {highSignal.map((post) => (
                <PostRow key={post.id} post={post} />
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {lowSignal.length > 0 && (
        <div className="mt-3 border-2 border-zinc-800 bg-zinc-900/30">
          <button
            type="button"
            onClick={() => setLowOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-800/40 transition-colors"
            aria-expanded={lowOpen}
          >
            <div className="flex items-center gap-3">
              <span className="font-mono-ui text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-none">
                Low priority
              </span>
              <span className="text-sm text-zinc-500">
                {lowSignal.length} post{lowSignal.length === 1 ? '' : 's'} ranked low
              </span>
            </div>
            <ChevronDown
              className={cn('h-4 w-4 text-zinc-500 transition-transform', lowOpen && 'rotate-180')}
            />
          </button>
          {lowOpen && (
            <div className="border-t-2 border-zinc-800 overflow-x-auto">
              <Table>
                <TableBody>
                  {lowSignal.map((post) => (
                    <PostRow key={post.id} post={post} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
