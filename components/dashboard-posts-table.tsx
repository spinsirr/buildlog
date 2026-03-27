import { GitBranch } from 'lucide-react'
import Link from 'next/link'
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
import { cn } from '@/lib/utils'

export function DashboardPostsTable({ posts }: { posts: Post[] }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-zinc-400">Recent Posts</h2>
        {posts.length > 0 && (
          <Link
            href="/posts"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            View all
          </Link>
        )}
      </div>
      <div className="rounded-lg bg-zinc-900/50 overflow-x-auto">
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
              {posts.map((post) => (
                <TableRow key={post.id} className="border-zinc-800 hover:bg-zinc-800/30">
                  <TableCell className="max-w-xs">
                    <p className="text-sm text-zinc-300 line-clamp-1">{post.content}</p>
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
                        'text-[10px]',
                        post.status === 'published'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-zinc-800 text-zinc-400 border-0'
                      )}
                    >
                      {post.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-zinc-500 font-mono-ui">
                    {new Date(post.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DashboardActions postId={post.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
