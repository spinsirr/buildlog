import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [{ data: repos }, { data: posts }] = await Promise.all([
      supabase.from("connected_repos").select("*").eq("user_id", user.id),
      supabase
        .from("posts")
        .select("*, connected_repos(full_name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const drafts = posts?.filter((p) => p.status === "draft") ?? [];
    const published = posts?.filter((p) => p.status === "published") ?? [];

    return NextResponse.json({
      stats: [
        { label: "Connected Repos", value: repos?.length ?? 0 },
        { label: "Draft Posts", value: drafts.length },
        { label: "Published", value: published.length },
        { label: "Streak Days", value: 0 },
      ],
      posts: posts ?? [],
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
