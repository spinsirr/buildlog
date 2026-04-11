'use client'

import { FileText, Loader2, Plus, Search, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { PostCard } from '@/components/post-card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { callEdgeFunction } from '@/lib/edge-function'
import { getEffectiveLimit } from '@/lib/platforms'
import { createClient } from '@/lib/supabase/client'
import type { Post } from '@/lib/types'
import { cn } from '@/lib/utils'

function NewPostForm({ onCreated, charLimit }: { onCreated: () => void; charLimit: number }) {
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState<'write' | 'confirm'>('write')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const charCount = content.length
  const overLimit = charCount > charLimit
  const canSubmit = content.trim().length > 0 && !overLimit

  useEffect(() => {
    if (step === 'write') textareaRef.current?.focus()
  }, [step])

  async function handleSubmit() {
    if (!content.trim()) return
    setBusy(true)
    const result = await callEdgeFunction<{ error?: string }>('create-post', {
      body: { content: content.trim() },
    })
    if (!result.ok) {
      if (result.code === 'plan_limit') {
        toast.error('Post limit reached', {
          description: result.error,
          action: { label: 'Upgrade', onClick: () => (window.location.href = '/settings') },
        })
      } else {
        toast.error('Create failed', { description: result.error || 'Failed to create post' })
      }
      setStep('write')
    } else {
      setContent('')
      setStep('write')
      onCreated()
      toast.success('Draft saved!', { description: 'Ready to review and publish.' })
    }
    setBusy(false)
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-1">
        <div
          className={cn(
            'h-1.5 flex-1 rounded-full transition-colors',
            step === 'write' ? 'bg-purple-500' : 'bg-purple-500'
          )}
        />
        <div
          className={cn(
            'h-1.5 flex-1 rounded-full transition-colors',
            step === 'confirm' ? 'bg-purple-500' : 'bg-zinc-800'
          )}
        />
      </div>

      {step === 'write' ? (
        <>
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            Step 1 — Write your update
          </label>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What did you build today?"
            aria-label="Write a build update"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 resize-none focus:outline-none focus:border-zinc-600 placeholder:text-zinc-500"
            rows={3}
          />
          <div className="flex items-center justify-between">
            <span
              className={cn('text-[11px] font-mono', overLimit ? 'text-red-400' : 'text-zinc-500')}
            >
              {charCount}/{charLimit}
            </span>
            <Button
              type="button"
              size="sm"
              disabled={!canSubmit}
              onClick={() => setStep('confirm')}
              className="bg-purple-600 hover:bg-purple-500 text-white border-0"
            >
              Next
            </Button>
          </div>
        </>
      ) : (
        <>
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            Step 2 — Looks good?
          </label>
          <div className="bg-zinc-950 rounded-lg p-3 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap border border-zinc-800">
            {content}
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setStep('write')}
              className="border-zinc-700 text-zinc-400 hover:bg-zinc-800"
            >
              Back
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={handleSubmit}
              className="bg-purple-600 hover:bg-purple-500 text-white border-0"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Save Draft
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center">
        <FileText className="h-6 w-6 text-zinc-500" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-zinc-400">No posts yet</p>
        <p className="text-xs text-zinc-500">
          Connect a repo and start committing, or write a post manually.
        </p>
      </div>
      <Link
        href="/repos"
        className={buttonVariants({
          variant: 'outline',
          size: 'sm',
          className: 'border-zinc-700 text-zinc-300',
        })}
      >
        Connect a repo
      </Link>
    </div>
  )
}

export function PostsClient({
  initialPosts,
  initialConnectedPlatforms,
  xPremium,
}: {
  initialPosts: Post[]
  initialConnectedPlatforms: string[]
  xPremium: boolean
}) {
  const supabase = useMemo(() => createClient(), [])
  const publishingRef = useRef(false)
  const searchParams = useSearchParams()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [showNewPost, setShowNewPost] = useState(false)
  const [posts, setPosts] = useState(initialPosts)
  const [search, setSearch] = useState('')
  const connectedPlatforms = initialConnectedPlatforms
  const charLimit = getEffectiveLimit(connectedPlatforms, xPremium)

  // Handle keyboard shortcut deep links
  useEffect(() => {
    if (searchParams.get('new') === '1') setShowNewPost(true)
    if (searchParams.get('focus') === 'search') {
      requestAnimationFrame(() => searchInputRef.current?.focus())
    }
  }, [searchParams])

  async function handleUpdate(id: string, updates: Record<string, unknown>) {
    if (updates.status === 'published') {
      if (publishingRef.current) return
      publishingRef.current = true
      try {
        setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)))
        const result = await callEdgeFunction<{ error?: string }>('publish-post', {
          body: { id, content: updates.content },
        })
        if (!result.ok) {
          await refreshPosts()
          throw new Error(result.error || 'Failed to publish')
        }
        await refreshPosts()
      } finally {
        publishingRef.current = false
      }
    } else {
      const { error } = await supabase
        .from('posts')
        .update({ content: updates.content })
        .eq('id', id)
      if (error) {
        await refreshPosts()
        throw new Error(error.message)
      }
    }
  }

  async function handleDelete(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id))
    const { error } = await supabase.from('posts').delete().eq('id', id)
    if (error) {
      toast.error('Delete failed', { description: error.message })
      await refreshPosts()
    }
  }

  async function handleRegenerate(id: string) {
    const result = await callEdgeFunction<{ post: Post }>('generate-post', {
      path: 'regenerate',
      body: { id },
    })
    if (!result.ok) throw new Error(result.error || 'Failed to regenerate')
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...result.data.post } : p)))
    await refreshPosts()
  }

  async function handleGenerateXhs(id: string): Promise<string> {
    const result = await callEdgeFunction<{ content: string }>('generate-post', {
      path: 'xhs-copy',
      body: { id },
    })
    if (!result.ok) throw new Error(result.error || '生成失败')
    return result.data.content
  }

  async function handleSchedule(id: string, scheduledAt: string | null) {
    const result = await callEdgeFunction<{ post: Post }>('schedule-post', {
      body: { id, scheduled_at: scheduledAt },
    })
    if (!result.ok) throw new Error(result.error || 'Failed to schedule')
    await refreshPosts()
  }

  async function refreshPosts() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('posts')
      .select('*, connected_repos(full_name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setPosts(data ?? [])
  }

  const filtered = search.trim()
    ? posts.filter(
        (p) =>
          p.content.toLowerCase().includes(search.toLowerCase()) ||
          p.connected_repos?.full_name.toLowerCase().includes(search.toLowerCase())
      )
    : posts
  const allPosts = filtered
  const drafts = allPosts.filter((p) => p.status === 'draft')
  const published = allPosts.filter((p) => p.status === 'published')
  const scheduled = allPosts.filter((p) => p.status === 'scheduled')

  function renderPosts(postList: Post[]) {
    if (postList.length === 0) return <EmptyState />
    return (
      <div className="flex flex-col gap-3">
        {postList.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onRegenerate={handleRegenerate}
            onGenerateXhs={handleGenerateXhs}
            onSchedule={handleSchedule}
            connectedPlatforms={connectedPlatforms}
            charLimit={charLimit}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Posts</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Review AI-generated drafts and publish to your platforms.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowNewPost((v) => !v)}
          className="bg-purple-600 hover:bg-purple-500 text-white border-0"
        >
          <Plus className="h-3.5 w-3.5" />
          New Post
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search posts..."
          aria-label="Search posts"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
        />
      </div>

      {showNewPost && (
        <NewPostForm
          onCreated={() => {
            refreshPosts()
            setShowNewPost(false)
          }}
          charLimit={charLimit}
        />
      )}

      <Tabs defaultValue="all">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="all" className="data-[state=active]:bg-zinc-800">
            All ({allPosts.length})
          </TabsTrigger>
          <TabsTrigger value="draft" className="data-[state=active]:bg-zinc-800">
            Draft ({drafts.length})
          </TabsTrigger>
          <TabsTrigger value="published" className="data-[state=active]:bg-zinc-800">
            Published ({published.length})
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="data-[state=active]:bg-zinc-800">
            Scheduled ({scheduled.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          {renderPosts(allPosts)}
        </TabsContent>
        <TabsContent value="draft" className="mt-4">
          {drafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="relative">
                <Sparkles className="h-8 w-8 text-emerald-400 animate-confetti-pop" />
                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400/30 animate-ping" />
              </div>
              <p className="text-base font-semibold text-emerald-400">Inbox zero!</p>
              <p className="text-xs text-zinc-500">No drafts waiting. You&apos;re crushing it.</p>
            </div>
          ) : (
            renderPosts(drafts)
          )}
        </TabsContent>
        <TabsContent value="published" className="mt-4">
          {published.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-sm text-zinc-500">No published posts yet.</p>
              <p className="text-xs text-zinc-500">Publish a draft to see it here.</p>
            </div>
          ) : (
            renderPosts(published)
          )}
        </TabsContent>
        <TabsContent value="scheduled" className="mt-4">
          {scheduled.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-sm text-zinc-500">No scheduled posts.</p>
              <p className="text-xs text-zinc-500">Schedule a draft to see it here.</p>
            </div>
          ) : (
            renderPosts(scheduled)
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
