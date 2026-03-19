import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { generatePost } from "@/lib/ai/generate-post";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const { data: post } = await supabase
      .from("posts")
      .select("source_type, source_data, connected_repos(full_name)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.source_type === "manual") {
      return NextResponse.json(
        { error: "Cannot regenerate a manual post" },
        { status: 400 }
      );
    }

    const repos = post.connected_repos as { full_name: string }[] | { full_name: string } | null;
    const repoName = Array.isArray(repos) ? repos[0]?.full_name ?? "unknown" : repos?.full_name ?? "unknown";
    const sourceData = (post.source_data ?? {}) as Record<string, string>;

    const { data: profile } = await supabase
      .from('profiles')
      .select('tone')
      .eq('id', user.id)
      .single()

    const content = await generatePost({
      sourceType: post.source_type as "commit" | "pr" | "release",
      repoName,
      tone: profile?.tone ?? 'casual',
      data: {
        message: sourceData.message,
        title: sourceData.title,
        description: sourceData.description,
        url: sourceData.url,
      },
    });

    const { data: updated, error } = await supabase
      .from("posts")
      .update({ content })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*, connected_repos(full_name)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ post: updated });
  } catch {
    return NextResponse.json(
      { error: "Failed to regenerate post" },
      { status: 500 }
    );
  }
}
