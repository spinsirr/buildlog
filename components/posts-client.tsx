"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Pencil,
  Send,
  Trash2,
  FileText,
  Check,
  X,
  Loader2,
  RefreshCw,
  Plus,
  ExternalLink,
  Eye,
  Hash,
  AtSign,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const platformConfig: Record<string, { label: string; color: string }> = {
  twitter: { label: "X", color: "bg-zinc-800 text-zinc-300" },
  linkedin: { label: "LinkedIn", color: "bg-blue-500/10 text-blue-400" },
  bluesky: { label: "Bluesky", color: "bg-sky-500/10 text-sky-400" },
};

type Post = {
  id: string;
  content: string;
  status: string;
  source_type: string;
  platforms: string[] | null;
  created_at: string;
  source_data: Record<string, unknown> | null;
  connected_repos: { full_name: string } | null;
  platform_post_url: string | null;
  published_at: string | null;
};

function renderPreviewContent(content: string) {
  return content.split(/(\s)/).map((word, i) => {
    if (word.match(/^#\w+/)) {
      return (
        <span key={i} className="text-sky-400">
          {word}
        </span>
      );
    }
    if (word.match(/^@\w+/)) {
      return (
        <span key={i} className="text-sky-400">
          {word}
        </span>
      );
    }
    if (word.match(/^https?:\/\//)) {
      return (
        <span key={i} className="text-sky-400 underline">
          {word.length > 23 ? `${word.slice(0, 23)}...` : word}
        </span>
      );
    }
    return word;
  });
}

function PostPreviewModal({
  content,
  open,
  onOpenChange,
  onConfirmPublish,
  busy,
  connectedPlatforms,
}: {
  content: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmPublish: () => void;
  busy: boolean;
  connectedPlatforms: string[];
}) {
  const charCount = content.length;
  const overLimit = charCount > 280;
  const remaining = 280 - charCount;

  const pct = Math.min(charCount / 280, 1);
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - pct);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-50">Post Preview</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-zinc-800" />
            <div>
              <div className="text-sm font-semibold text-zinc-200">You</div>
              <div className="text-xs text-zinc-500">@your_handle</div>
            </div>
          </div>
          <p className="text-[15px] text-zinc-200 leading-relaxed whitespace-pre-wrap">
            {renderPreviewContent(content)}
          </p>
          <div className="text-xs text-zinc-600">
            {new Date().toLocaleDateString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Hash className="h-3 w-3 text-zinc-500" />
              <span className="text-xs text-zinc-500">
                {(content.match(/#\w+/g) || []).length} hashtags
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <AtSign className="h-3 w-3 text-zinc-500" />
              <span className="text-xs text-zinc-500">
                {(content.match(/@\w+/g) || []).length} mentions
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {remaining <= 20 && (
              <span
                className={cn(
                  "text-xs font-mono",
                  overLimit ? "text-red-400" : remaining <= 0 ? "text-red-400" : "text-amber-400"
                )}
              >
                {remaining}
              </span>
            )}
            <svg width="24" height="24" viewBox="0 0 24 24" className="-rotate-90">
              <circle
                cx="12"
                cy="12"
                r={radius}
                fill="none"
                stroke="rgb(63 63 70)"
                strokeWidth="2"
              />
              <circle
                cx="12"
                cy="12"
                r={radius}
                fill="none"
                stroke={overLimit ? "rgb(248 113 113)" : remaining <= 20 ? "rgb(251 191 36)" : "rgb(99 102 241)"}
                strokeWidth="2"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {overLimit && (
          <div className="text-xs text-red-400 bg-red-500/10 rounded-md px-3 py-2">
            Post exceeds the 280 character limit by {charCount - 280} characters. Edit the post before publishing.
          </div>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-zinc-400 text-xs font-medium hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirmPublish}
            disabled={busy || overLimit || connectedPlatforms.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            {connectedPlatforms.length === 0
              ? "No platforms connected"
              : `Publish to ${connectedPlatforms.map(p => platformConfig[p]?.label ?? p).join(" + ")}`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PostCard({
  post,
  onUpdate,
  onDelete,
  onRegenerate,
  connectedPlatforms,
}: {
  post: Post;
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRegenerate: (id: string) => Promise<void>;
  connectedPlatforms: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [busy, setBusy] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const commitHash =
    post.source_data &&
    typeof post.source_data === "object" &&
    "url" in post.source_data
      ? (post.source_data.url as string)?.split("/").pop()?.slice(0, 7)
      : null;

  const charCount = (editing ? editContent : post.content).length;
  const overLimit = charCount > 280;

  async function handleSave() {
    setBusy(true);
    await onUpdate(post.id, { content: editContent });
    setEditing(false);
    setBusy(false);
  }

  async function handleConfirmPublish() {
    setBusy(true);
    try {
      await onUpdate(post.id, { status: "published" });
      setShowPreview(false);
      toast.success("Post published", {
        description: connectedPlatforms.map(p => platformConfig[p]?.label ?? p).join(", "),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to publish");
    }
    setBusy(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this post?")) return;
    setBusy(true);
    await onDelete(post.id);
    toast.success("Post deleted");
    setBusy(false);
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      await onRegenerate(post.id);
      toast.success("Post regenerated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to regenerate");
    }
    setRegenerating(false);
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors">
      <CardContent className="pt-5 space-y-4">
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md p-3 text-sm text-zinc-200 resize-none focus:outline-none focus:border-zinc-500"
              rows={4}
            />
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-700 text-zinc-200 text-xs font-medium hover:bg-zinc-600 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setEditContent(post.content);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-zinc-400 text-xs font-medium hover:text-zinc-200"
                >
                  <X className="h-3 w-3" />
                  Cancel
                </button>
              </div>
              <span
                className={cn(
                  "text-[11px] font-mono",
                  overLimit ? "text-red-400" : "text-zinc-600"
                )}
              >
                {charCount}/280
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {post.content}
          </p>
        )}

        {post.status === "published" && (
          <div className="flex items-center gap-3">
            {post.platform_post_url && (
              <a
                href={post.platform_post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                View post
              </a>
            )}
            {post.platforms && post.platforms.length > 0 && (
              <div className="flex items-center gap-1.5">
                {post.platforms.map((p) => (
                  <Badge
                    key={p}
                    variant="secondary"
                    className={cn("text-[10px] border-0", platformConfig[p]?.color ?? "bg-zinc-800 text-zinc-500")}
                  >
                    {platformConfig[p]?.label ?? p}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        <Separator className="bg-zinc-800" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] border-0",
                post.status === "published"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : post.status === "draft"
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-zinc-800 text-zinc-500"
              )}
            >
              {post.status}
            </Badge>
            <Badge
              variant="secondary"
              className="text-[10px] border-0 bg-zinc-800 text-zinc-500"
            >
              {post.source_type}
            </Badge>
            {post.connected_repos && (
              <span className="text-[11px] text-zinc-600 font-mono">
                {post.connected_repos.full_name}
                {commitHash && (
                  <span className="text-zinc-700"> @ {commitHash}</span>
                )}
              </span>
            )}
            {!editing && (
              <span
                className={cn(
                  "text-[11px] font-mono",
                  overLimit ? "text-red-400" : "text-zinc-600"
                )}
              >
                {charCount}/280
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {post.status === "draft" && post.source_type !== "manual" && (
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={regenerating || busy}
                className="p-1.5 rounded-md text-zinc-500 hover:text-amber-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                title="Regenerate with AI"
              >
                {regenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </button>
            )}
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                disabled={busy}
                className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                title="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {post.status === "draft" && (
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                disabled={busy}
                className="p-1.5 rounded-md text-zinc-500 hover:text-sky-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                title="Preview post"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
            )}
            {post.status === "draft" && (
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                disabled={busy || overLimit}
                className="p-1.5 rounded-md text-zinc-500 hover:text-indigo-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                title={
                  overLimit
                    ? "Post exceeds 280 characters"
                    : connectedPlatforms.length === 0
                      ? "No platforms connected"
                      : `Publish to ${connectedPlatforms.map(p => platformConfig[p]?.label ?? p).join(" + ")}`
                }
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </CardContent>

      <PostPreviewModal
        content={editing ? editContent : post.content}
        open={showPreview}
        onOpenChange={setShowPreview}
        onConfirmPublish={handleConfirmPublish}
        busy={busy}
        connectedPlatforms={connectedPlatforms}
      />
    </Card>
  );
}

function NewPostForm({ onCreated }: { onCreated: () => void }) {
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const charCount = content.length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("create-post", {
      body: { content: content.trim() },
    });
    if (error) {
      toast.error(data?.error || "Failed to create post");
    } else {
      setContent("");
      onCreated();
      toast.success("Post created");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a build update..."
        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 resize-none focus:outline-none focus:border-zinc-600 placeholder:text-zinc-600"
        rows={3}
      />
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-[11px] font-mono",
            charCount > 280 ? "text-red-400" : "text-zinc-600"
          )}
        >
          {charCount}/280
        </span>
        <button
          type="submit"
          disabled={busy || !content.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
          Create Draft
        </button>
      </div>
    </form>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center">
        <FileText className="h-6 w-6 text-zinc-600" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-zinc-400">No posts yet</p>
        <p className="text-xs text-zinc-600">
          Connect a repo and start committing, or write a post manually.
        </p>
      </div>
      <Link
        href="/repos"
        className="inline-flex items-center justify-center h-7 px-2.5 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-[0.8rem] font-medium transition-colors"
      >
        Connect a repo
      </Link>
    </div>
  );
}

export function PostsClient({
  initialPosts,
  initialConnectedPlatforms,
}: {
  initialPosts: Post[];
  initialConnectedPlatforms: string[];
}) {
  const [showNewPost, setShowNewPost] = useState(false);
  const [posts, setPosts] = useState(initialPosts);
  const connectedPlatforms = initialConnectedPlatforms;

  async function handleUpdate(id: string, updates: Record<string, unknown>) {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));

    if (updates.status === "published") {
      const { data, error } = await supabase.functions.invoke("publish-post", {
        body: { id, content: updates.content },
      });
      if (error || data?.error) {
        await refreshPosts();
        throw new Error(data?.error || "Failed to publish");
      }
      await refreshPosts();
    } else {
      const { error } = await supabase
        .from("posts")
        .update({ content: updates.content })
        .eq("id", id);
      if (error) {
        await refreshPosts();
        throw new Error(error.message);
      }
    }
  }

  async function handleDelete(id: string) {
    setPosts(prev => prev.filter(p => p.id !== id));
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete post");
      await refreshPosts();
    }
  }

  async function handleRegenerate(id: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-post/regenerate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ id }),
      }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to regenerate");
    }
    const { post } = await res.json();
    setPosts(prev => prev.map(p => p.id === id ? { ...p, ...post } : p));
  }

  async function refreshPosts() {
    const { data } = await supabase
      .from("posts")
      .select("*, connected_repos(full_name)")
      .order("created_at", { ascending: false });
    setPosts(data ?? []);
  }

  const allPosts = posts;
  const drafts = allPosts.filter((p) => p.status === "draft");
  const published = allPosts.filter((p) => p.status === "published");

  function renderPosts(postList: Post[]) {
    if (postList.length === 0) return <EmptyState />;
    return (
      <div className="flex flex-col gap-3">
        {postList.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onRegenerate={handleRegenerate}
            connectedPlatforms={connectedPlatforms}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Posts</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Review AI-generated drafts and publish to your platforms.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewPost((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Post
        </button>
      </div>

      {showNewPost && (
        <NewPostForm
          onCreated={() => {
            refreshPosts();
            setShowNewPost(false);
          }}
        />
      )}

      <Tabs defaultValue="all">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-zinc-800"
          >
            All ({allPosts.length})
          </TabsTrigger>
          <TabsTrigger
            value="draft"
            className="data-[state=active]:bg-zinc-800"
          >
            Draft ({drafts.length})
          </TabsTrigger>
          <TabsTrigger
            value="published"
            className="data-[state=active]:bg-zinc-800"
          >
            Published ({published.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          {renderPosts(allPosts)}
        </TabsContent>
        <TabsContent value="draft" className="mt-4">
          {renderPosts(drafts)}
        </TabsContent>
        <TabsContent value="published" className="mt-4">
          {published.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-sm text-zinc-500">
                No published posts yet.
              </p>
              <p className="text-xs text-zinc-600">
                Publish a draft to see it here.
              </p>
            </div>
          ) : (
            renderPosts(published)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
