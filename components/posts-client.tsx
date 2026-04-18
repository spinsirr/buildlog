'use client'

import { ChevronDown, FileText, GitBranch, Loader2, Plus, Search, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useSWRConfig } from 'swr'
import { PostCard } from '@/components/post-card'
import { RecapBranchPicker } from '@/components/recap-branch-picker'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { callEdgeFunction } from '@/lib/edge-function'
import { usePostsData, useRealtimePosts } from '@/lib/hooks/use-dashboard-data'
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
    <div className="rounded-none border-2 border-zinc-700 bg-zinc-900/50 p-4 space-y-3">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-1">
        <div className={cn('h-1.5 flex-1 rounded-full transition-colors bg-neo-accent')} />
        <div
          className={cn(
            'h-1.5 flex-1 rounded-full transition-colors',
            step === 'confirm' ? 'bg-neo-accent' : 'bg-zinc-800'
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
              className="bg-neo-accent hover:bg-neo-accent/90 text-white border-2 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(255,255,255,0.1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
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
              className="bg-neo-accent hover:bg-neo-accent/90 text-white border-2 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(255,255,255,0.1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
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

/** Collapsible section for AI-rated low-signal drafts. */
type LowSignalDisclosureProps = {
  drafts: Post[]
  onUpdate: (id: string, updates: Record<string, unknown>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onRegenerate: (id: string) => Promise<void>
  onGenerateVariant: (id: string, platform: string) => Promise<Post>
  onSaveDetails: (
    id: string,
    updates: { content?: string; platform_variants?: Record<string, string> }
  ) => Promise<void>
  onSchedule: (id: string, scheduledAt: string | null) => Promise<void>
  connectedPlatforms: string[]
  charLimit: number
  xPremium: boolean
}

function LowSignalDisclosure({ drafts, ...handlers }: LowSignalDisclosureProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-2 border-zinc-800 bg-zinc-900/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-800/40 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <span className="font-mono-ui text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-none">
            Low priority
          </span>
          <span className="text-sm text-zinc-300">
            {drafts.length} draft{drafts.length === 1 ? '' : 's'} AI ranked as internal / trivial
          </span>
        </div>
        <ChevronDown
          className={cn('h-4 w-4 text-zinc-500 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-3 p-3 border-t-2 border-zinc-800">
          {drafts.map((post) => (
            <div key={post.id} className="space-y-1">
              {post.signal_reason && (
                <p className="font-mono-ui text-[11px] uppercase tracking-wider text-zinc-500 px-1">
                  <span className="text-zinc-600">AI: </span>
                  {post.signal_reason}
                </p>
              )}
              <PostCard
                post={post}
                onUpdate={handlers.onUpdate}
                onDelete={handlers.onDelete}
                onRegenerate={handlers.onRegenerate}
                onGenerateVariant={handlers.onGenerateVariant}
                onSaveDetails={handlers.onSaveDetails}
                onSchedule={handlers.onSchedule}
                connectedPlatforms={handlers.connectedPlatforms}
                charLimit={handlers.charLimit}
                xPremium={handlers.xPremium}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type PostsData = { posts: Post[]; connectedPlatforms: string[]; xPremium: boolean }

export function PostsClient() {
  const supabase = useMemo(() => createClient(), [])
  const { mutate: globalMutate } = useSWRConfig()
  const { data, mutate } = usePostsData()
  useRealtimePosts()
  const posts = (data?.posts ?? []) as Post[]
  const connectedPlatforms = data?.connectedPlatforms ?? []
  const xPremium = data?.xPremium ?? false
  const publishingRef = useRef(false)
  const searchParams = useSearchParams()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [showNewPost, setShowNewPost] = useState(false)
  const [search, setSearch] = useState('')
  const charLimit = getEffectiveLimit(connectedPlatforms, xPremium)
  const [recapLoading, setRecapLoading] = useState(false)
  const [branchPickerOpen, setBranchPickerOpen] = useState(false)

  async function handleGenerateRecap(opts?: {
    mode?: 'week' | 'branch'
    repo?: string
    branch?: string
  }) {
    setRecapLoading(true)
    try {
      const body = opts?.mode ? opts : undefined
      const res = await callEdgeFunction<{ ok: boolean; reason?: string; post?: Post }>(
        'generate-recap',
        body ? { body } : undefined
      )
      if (!res.ok) {
        toast.error('Failed to generate recap', { description: res.error })
        return
      }
      const data = res.data
      if (!data.ok) {
        if (data.reason === 'no_activity') {
          toast('No activity to recap — nothing found in the last 7 days')
        } else if (data.reason === 'recap_exists') {
          toast('You already have a recap for this. Delete it to regenerate.')
        } else if (data.reason === 'invalid_request') {
          toast.error('Invalid request', { description: data.reason })
        } else {
          toast.error('Recap generation failed', { description: data.reason })
        }
        return
      }
      const label = opts?.mode === 'branch' ? 'Branch recap' : 'Weekly recap'
      toast.success(`${label} generated!`)
      mutate()
    } catch {
      toast.error('Failed to generate recap')
    } finally {
      setRecapLoading(false)
    }
  }

  // Handle keyboard shortcut deep links
  useEffect(() => {
    if (searchParams.get('new') === '1') setShowNewPost(true)
    if (searchParams.get('focus') === 'search') {
      requestAnimationFrame(() => searchInputRef.current?.focus())
    }
  }, [searchParams])

  // Handlers are memoized so that PostCard (wrapped in React.memo) gets stable
  // prop references across parent re-renders (search typing, tab switches).
  // Without this, every keystroke would recreate all handlers, break memo
  // equality, and re-render every card in the list.
  const handleUpdate = useCallback(
    async (id: string, updates: Record<string, unknown>) => {
      if (updates.status === 'published') {
        if (publishingRef.current) return
        publishingRef.current = true
        try {
          await mutate(
            async () => {
              const result = await callEdgeFunction<{ error?: string }>('publish-post', {
                body: { id, content: updates.content },
              })
              if (!result.ok) throw new Error(result.error || 'Failed to publish')
              return undefined // revalidate from server
            },
            {
              optimisticData: (current: PostsData | undefined) => ({
                ...current!,
                posts: current!.posts.map((p: Post) => (p.id === id ? { ...p, ...updates } : p)),
              }),
              rollbackOnError: true,
            }
          )
          globalMutate(
            (key: unknown) =>
              Array.isArray(key) && (key[0] === 'draft-count' || key[0] === 'dashboard-data')
          )
        } finally {
          publishingRef.current = false
        }
      } else {
        const { error } = await supabase
          .from('posts')
          .update({ content: updates.content })
          .eq('id', id)
        if (error) {
          mutate()
          throw new Error(error.message)
        }
      }
    },
    [mutate, globalMutate, supabase]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      mutate(
        async (current: PostsData | undefined) => {
          const { error } = await supabase.from('posts').delete().eq('id', id)
          if (error) {
            toast.error('Delete failed', { description: error.message })
            throw error
          }
          return { ...current!, posts: current!.posts.filter((p: Post) => p.id !== id) }
        },
        {
          optimisticData: (current: PostsData | undefined) => ({
            ...current!,
            posts: current!.posts.filter((p: Post) => p.id !== id),
          }),
          rollbackOnError: true,
          revalidate: false,
        }
      )
      globalMutate(
        (key: unknown) =>
          Array.isArray(key) && (key[0] === 'draft-count' || key[0] === 'dashboard-data')
      )
    },
    [mutate, globalMutate, supabase]
  )

  const handleRegenerate = useCallback(
    async (id: string) => {
      const result = await callEdgeFunction<{ post: Post }>('generate-post', {
        path: 'regenerate',
        body: { id },
      })
      if (!result.ok) throw new Error(result.error || 'Failed to regenerate')
      mutate(
        (current: PostsData | undefined) => ({
          ...current!,
          posts: current!.posts.map((p: Post) => (p.id === id ? { ...p, ...result.data.post } : p)),
        }),
        { revalidate: false }
      )
    },
    [mutate]
  )

  // Generate a persistent per-platform variant. Unlike the legacy XHS/LinkedIn
  // copy flows (which return ephemeral text for the user to paste elsewhere),
  // this writes the result into posts.platform_variants[platform] so it is
  // used automatically when publishing to that platform.
  const handleGenerateVariant = useCallback(
    async (id: string, platform: string): Promise<Post> => {
      const result = await callEdgeFunction<{ post: Post }>('generate-post', {
        path: 'variant',
        body: { id, platform },
      })
      if (!result.ok) throw new Error(result.error || 'Generation failed')
      mutate(
        (current: PostsData | undefined) => ({
          ...current!,
          posts: current!.posts.map((p: Post) => (p.id === id ? { ...p, ...result.data.post } : p)),
        }),
        { revalidate: false }
      )
      return result.data.post
    },
    [mutate]
  )

  // Save both default content and platform variants in one round-trip from
  // the PostDetailModal. Uses a direct supabase update since we only touch
  // editable fields (no publish-side effects).
  const handleSaveDetails = useCallback(
    async (
      id: string,
      updates: { content?: string; platform_variants?: Record<string, string> }
    ) => {
      const payload: Record<string, unknown> = {}
      if (typeof updates.content === 'string') payload.content = updates.content
      if (updates.platform_variants) payload.platform_variants = updates.platform_variants
      if (Object.keys(payload).length === 0) return
      const { error } = await supabase.from('posts').update(payload).eq('id', id)
      if (error) {
        mutate()
        throw new Error(error.message)
      }
      mutate()
    },
    [supabase, mutate]
  )

  const handleSchedule = useCallback(
    async (id: string, scheduledAt: string | null) => {
      const result = await callEdgeFunction<{ post: Post }>('schedule-post', {
        body: { id, scheduled_at: scheduledAt },
      })
      if (!result.ok) throw new Error(result.error || 'Failed to schedule')
      mutate()
    },
    [mutate]
  )

  // Memoized so that unrelated re-renders (e.g., opening the NewPost form)
  // don't re-filter/re-partition the entire posts array.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return posts
    return posts.filter(
      (p) =>
        p.content.toLowerCase().includes(q) ||
        p.connected_repos?.full_name.toLowerCase().includes(q)
    )
  }, [posts, search])
  const drafts = useMemo(() => filtered.filter((p) => p.status === 'draft'), [filtered])
  const published = useMemo(() => filtered.filter((p) => p.status === 'published'), [filtered])
  const scheduled = useMemo(() => filtered.filter((p) => p.status === 'scheduled'), [filtered])

  function renderPosts(postList: Post[]) {
    if (postList.length === 0) return <EmptyState />
    return (
      <div className="flex flex-col gap-5">
        {postList.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onRegenerate={handleRegenerate}
            onGenerateVariant={handleGenerateVariant}
            onSaveDetails={handleSaveDetails}
            onSchedule={handleSchedule}
            connectedPlatforms={connectedPlatforms}
            charLimit={charLimit}
            xPremium={xPremium}
          />
        ))}
      </div>
    )
  }

  /**
   * Drafts view: shows high-signal (and unrated manual) drafts at the top,
   * collapses AI-rated low-signal drafts under a disclosure so noise doesn't
   * drown out ship-worthy content.
   */
  function renderDrafts(draftList: Post[]) {
    const highSignal = draftList.filter((p) => p.signal !== 'low')
    const lowSignal = draftList.filter((p) => p.signal === 'low')

    return (
      <div className="flex flex-col gap-5">
        {highSignal.length === 0 ? (
          lowSignal.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-2 border-2 border-dashed border-zinc-800 rounded-none">
              <p className="text-sm text-zinc-400">No high-signal drafts.</p>
              <p className="text-xs text-zinc-500">
                {lowSignal.length} low-priority below — expand to review.
              </p>
            </div>
          )
        ) : (
          highSignal.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onRegenerate={handleRegenerate}
              onGenerateVariant={handleGenerateVariant}
              onSaveDetails={handleSaveDetails}
              onSchedule={handleSchedule}
              connectedPlatforms={connectedPlatforms}
              charLimit={charLimit}
              xPremium={xPremium}
            />
          ))
        )}

        {lowSignal.length > 0 && (
          <LowSignalDisclosure
            drafts={lowSignal}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onRegenerate={handleRegenerate}
            onGenerateVariant={handleGenerateVariant}
            onSaveDetails={handleSaveDetails}
            onSchedule={handleSchedule}
            connectedPlatforms={connectedPlatforms}
            charLimit={charLimit}
            xPremium={xPremium}
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold uppercase tracking-tight text-zinc-50">
            Posts
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Review AI-generated drafts and publish to your platforms.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={recapLoading}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-transparent px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
            >
              {recapLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Recap
              <ChevronDown className="h-3 w-3 opacity-50" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 text-zinc-200">
              <DropdownMenuItem
                onClick={() => handleGenerateRecap({ mode: 'week' })}
                className="focus:bg-zinc-800"
              >
                <Sparkles className="h-3.5 w-3.5 mr-2" />
                Weekly Recap
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem
                onClick={() => setBranchPickerOpen(true)}
                className="focus:bg-zinc-800"
              >
                <GitBranch className="h-3.5 w-3.5 mr-2" />
                From Branch...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <RecapBranchPicker
            open={branchPickerOpen}
            onOpenChange={setBranchPickerOpen}
            onGenerate={(repo, branch) => {
              setBranchPickerOpen(false)
              handleGenerateRecap({ mode: 'branch', repo, branch })
            }}
            loading={recapLoading}
          />
          <Button
            size="sm"
            onClick={() => setShowNewPost((v) => !v)}
            className="bg-neo-accent hover:bg-neo-accent/90 text-white border-2 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(255,255,255,0.1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          >
            <Plus className="h-3.5 w-3.5" />
            New Post
          </Button>
        </div>
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
            mutate()
            globalMutate(
              (key: unknown) =>
                Array.isArray(key) && (key[0] === 'draft-count' || key[0] === 'dashboard-data')
            )
            setShowNewPost(false)
          }}
          charLimit={charLimit}
        />
      )}

      <Tabs defaultValue="all">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="all" className="data-[state=active]:bg-zinc-800">
            All ({filtered.length})
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
          {renderPosts(filtered)}
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
            renderDrafts(drafts)
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
