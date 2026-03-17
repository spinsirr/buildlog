import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Pencil, Send, Trash2, GitBranch, FileText } from "lucide-react";

const platformConfig: Record<string, { label: string; color: string }> = {
  twitter: { label: "X", color: "bg-zinc-800 text-zinc-300" },
  linkedin: { label: "LinkedIn", color: "bg-blue-500/10 text-blue-400" },
  bluesky: { label: "Bluesky", color: "bg-sky-500/10 text-sky-400" },
};

function PostCard({
  post,
}: {
  post: {
    id: string;
    content: string;
    status: string;
    source_type: string;
    platforms: string[] | null;
    created_at: string;
    source_data: Record<string, unknown> | null;
    connected_repos: { full_name: string } | null;
  };
}) {
  const commitHash =
    post.source_data &&
    typeof post.source_data === "object" &&
    "url" in post.source_data
      ? (post.source_data.url as string)?.split("/").pop()?.slice(0, 7)
      : null;

  return (
    <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors">
      <CardContent className="pt-5 space-y-4">
        {/* Post text */}
        <p className="text-sm text-zinc-300 leading-relaxed line-clamp-2">
          {post.content}
        </p>

        {/* Platform chips */}
        <div className="flex items-center gap-2">
          {["twitter", "linkedin", "bluesky"].map((platform) => {
            const config = platformConfig[platform];
            const isActive = (post.platforms ?? []).includes(platform);
            return (
              <span
                key={platform}
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors",
                  isActive ? config.color : "bg-zinc-800/50 text-zinc-600"
                )}
              >
                {config.label}
              </span>
            );
          })}
        </div>

        <Separator className="bg-zinc-800" />

        {/* Footer */}
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
            {post.connected_repos && (
              <span className="text-[11px] text-zinc-600 font-mono">
                {post.connected_repos.full_name}
                {commitHash && (
                  <span className="text-zinc-700"> @ {commitHash}</span>
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {post.status === "draft" && (
              <button
                type="button"
                className="p-1.5 rounded-md text-zinc-500 hover:text-indigo-400 hover:bg-zinc-800 transition-colors"
                title="Publish"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
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
          Connect a repo and start committing to generate your first post.
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

export default async function PostsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: posts } = await supabase
    .from("posts")
    .select("*, connected_repos(full_name)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  const allPosts = posts ?? [];
  const drafts = allPosts.filter((p) => p.status === "draft");
  const published = allPosts.filter((p) => p.status === "published");

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Draft Posts</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Review AI-generated drafts and publish to your platforms.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="all" className="data-[state=active]:bg-zinc-800">
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
          {allPosts.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex flex-col gap-3">
              {allPosts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="draft" className="mt-4">
          {drafts.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex flex-col gap-3">
              {drafts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="published" className="mt-4">
          {published.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-sm text-zinc-500">No published posts yet.</p>
              <p className="text-xs text-zinc-600">
                Publish a draft to see it here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {published.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
