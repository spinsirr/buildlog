'use client'

import useSWR from 'swr'
import { useState } from 'react'
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Circle, GitBranch, Loader2, Pencil, Share2, Sparkles, Trash2 } from "lucide-react";
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

const platformLabels: Record<string, string> = {
  twitter: "X",
  linkedin: "LinkedIn",
  bluesky: "Bluesky",
};

interface DashboardData {
  stats: { label: string; value: number }[]
  posts: {
    id: string
    content: string
    status: string
    platforms: string[] | null
    created_at: string
    connected_repos: { full_name: string } | null
  }[]
  connections: number
}

async function fetchDashboard() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const [{ data: repos }, { data: posts }, { count: connectionsCount }] = await Promise.all([
    supabase.from('connected_repos').select('*').eq('user_id', user.id),
    supabase.from('posts').select('*, connected_repos(full_name)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('platform_connections').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
  ])

  const drafts = posts?.filter(p => p.status === 'draft') ?? []
  const published = posts?.filter(p => p.status === 'published') ?? []

  // Calculate streak
  const { data: streakPosts } = await supabase.from('posts').select('created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100)
  let streak = 0
  if (streakPosts && streakPosts.length > 0) {
    const today = new Date(); today.setHours(0,0,0,0)
    const postDays = new Set(streakPosts.map(p => { const d = new Date(p.created_at); d.setHours(0,0,0,0); return d.getTime() }))
    const dayMs = 86400000
    let checkDate = today.getTime()
    if (!postDays.has(checkDate)) checkDate = today.getTime() - dayMs
    while (postDays.has(checkDate)) { streak++; checkDate -= dayMs }
  }

  return {
    stats: [
      { label: 'Connected Repos', value: repos?.length ?? 0 },
      { label: 'Draft Posts', value: drafts.length },
      { label: 'Published', value: published.length },
      { label: 'Streak Days', value: streak },
    ],
    posts: posts ?? [],
    connections: connectionsCount ?? 0,
  }
}

export default function DashboardPage() {
  const { data, isLoading, mutate } = useSWR<DashboardData>('dashboard', fetchDashboard)
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(postId: string) {
    if (!confirm('Delete this post?')) return
    setDeletingId(postId)
    try {
      await supabase.from('posts').delete().eq('id', postId)
      mutate(data ? { ...data, posts: data.posts.filter(p => p.id !== postId) } : undefined, { revalidate: true })
    } finally {
      setDeletingId(null)
    }
  }

  const stats = data?.stats ?? [
    { label: "Connected Repos", value: 0 },
    { label: "Draft Posts", value: 0 },
    { label: "Published", value: 0 },
    { label: "Streak Days", value: 0 },
  ]
  const posts = data?.posts ?? []
  const connections = data?.connections ?? 0

  const hasRepos = (stats.find(s => s.label === 'Connected Repos')?.value ?? 0) > 0
  const hasSocial = connections > 0
  const hasPosts = posts.length > 0
  const showOnboarding = !isLoading && (!hasRepos || !hasSocial || !hasPosts)

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-50">Dashboard</h1>
        <Link
          href="/repos"
          className="inline-flex items-center justify-center h-7 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[0.8rem] font-medium transition-colors"
        >
          Connect repo
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={cn(
              "rounded-lg bg-zinc-900/50 px-4 py-3",
              isLoading && "animate-pulse"
            )}
          >
            <span className="text-xs text-zinc-500">
              {stat.label}
            </span>
            <p className="text-2xl font-semibold text-zinc-100 mt-1">
              {isLoading ? "–" : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Onboarding */}
      {showOnboarding && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-zinc-50 text-base">Get started</CardTitle>
            <CardDescription className="text-zinc-500">
              Complete these steps to start building in public.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { done: hasRepos, label: 'Connect a GitHub repo', href: '/repos', icon: GitBranch },
              { done: hasSocial, label: 'Connect a social account', href: '/settings', icon: Share2 },
              { done: hasPosts, label: 'Generate your first post', href: '/posts', icon: Sparkles },
            ].map((step, i) => (
              <Link
                key={i}
                href={step.href}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                  step.done
                    ? 'border-zinc-800 bg-zinc-900/50'
                    : 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800'
                )}
              >
                <div className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center shrink-0',
                  step.done ? 'bg-emerald-500/10' : 'bg-zinc-800'
                )}>
                  {step.done ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-zinc-600" />
                  )}
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <step.icon className={cn('h-4 w-4 shrink-0', step.done ? 'text-zinc-600' : 'text-zinc-400')} />
                  <span className={cn('text-sm', step.done ? 'text-zinc-600 line-through' : 'text-zinc-300')}>
                    {step.label}
                  </span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Posts */}
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
          {isLoading ? (
            <div className="py-12 text-center text-sm text-zinc-500">Loading…</div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center">
                <GitBranch className="h-6 w-6 text-zinc-600" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-zinc-400">
                  No posts yet
                </p>
                <p className="text-xs text-zinc-600">
                  Connect a repo to start generating posts from your commits.
                </p>
              </div>
              <Link
                href="/repos"
                className="inline-flex items-center justify-center h-7 px-2.5 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-[0.8rem] font-medium transition-colors"
              >
                Connect your first repo
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-500">Post</TableHead>
                  <TableHead className="text-zinc-500">Platforms</TableHead>
                  <TableHead className="text-zinc-500">Status</TableHead>
                  <TableHead className="text-zinc-500">Date</TableHead>
                  <TableHead className="text-zinc-500 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow
                    key={post.id}
                    className="border-zinc-800 hover:bg-zinc-800/30"
                  >
                    <TableCell className="max-w-xs">
                      <p className="text-sm text-zinc-300 line-clamp-1">
                        {post.content}
                      </p>
                      {post.connected_repos && (
                        <span className="text-xs text-zinc-600 font-mono">
                          {post.connected_repos.full_name}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {post.platforms?.length ? (
                          post.platforms.map((p) => (
                            <Badge
                              key={p}
                              variant="secondary"
                              className="bg-zinc-800 text-zinc-400 text-[10px] border-0"
                            >
                              {platformLabels[p] ?? p}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-600">--</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          post.status === "published" ? "default" : "secondary"
                        }
                        className={cn(
                          "text-[10px]",
                          post.status === "published"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-zinc-800 text-zinc-400 border-0"
                        )}
                      >
                        {post.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-zinc-500 font-mono">
                      {new Date(post.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => router.push(`/posts?edit=${post.id}`)}
                          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(post.id)}
                          disabled={deletingId === post.id}
                          className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                        >
                          {deletingId === post.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
