import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  GitFork,
  FileText,
  Send,
  Flame,
  GitBranch,
  Pencil,
  Trash2,
} from "lucide-react";

const platformLabels: Record<string, string> = {
  twitter: "X",
  linkedin: "LinkedIn",
  bluesky: "Bluesky",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: repos }, { data: posts }] = await Promise.all([
    supabase.from("connected_repos").select("*").eq("user_id", user!.id),
    supabase
      .from("posts")
      .select("*, connected_repos(full_name)")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const drafts = posts?.filter((p) => p.status === "draft") ?? [];
  const published = posts?.filter((p) => p.status === "published") ?? [];

  const stats = [
    {
      label: "Connected Repos",
      value: repos?.length ?? 0,
      icon: GitFork,
    },
    {
      label: "Draft Posts",
      value: drafts.length,
      icon: FileText,
    },
    {
      label: "Published",
      value: published.length,
      icon: Send,
    },
    {
      label: "Streak Days",
      value: 0,
      icon: Flame,
    },
  ];

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-zinc-500 uppercase tracking-wider">
                  {stat.label}
                </span>
                <stat.icon className="h-4 w-4 text-zinc-600" />
              </div>
              <p className="text-3xl font-bold text-zinc-50 font-mono">
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Posts */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-zinc-50">Recent Posts</CardTitle>
              <CardDescription className="text-zinc-500">
                Your latest generated drafts
              </CardDescription>
            </div>
            {(posts?.length ?? 0) > 0 && (
              <Link
                href="/posts"
                className="text-sm text-zinc-400 hover:text-zinc-50 transition-colors"
              >
                View all
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!posts || posts.length === 0 ? (
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
                          {
                            (post.connected_repos as { full_name: string })
                              .full_name
                          }
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(post.platforms as string[] | null)?.length ? (
                          (post.platforms as string[]).map((p) => (
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
                          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
