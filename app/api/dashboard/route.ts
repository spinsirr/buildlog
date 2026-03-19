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

    const [{ data: repos }, { data: posts }, { count: connectionsCount }] = await Promise.all([
      supabase.from("connected_repos").select("*").eq("user_id", user.id),
      supabase
        .from("posts")
        .select("*, connected_repos(full_name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("platform_connections")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);

    const drafts = posts?.filter((p) => p.status === "draft") ?? [];
    const published = posts?.filter((p) => p.status === "published") ?? [];

    // Calculate posting streak (consecutive days with at least one post)
    const { data: streakPosts } = await supabase
      .from("posts")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    let streak = 0;
    if (streakPosts && streakPosts.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const postDays = new Set(
        streakPosts.map((p) => {
          const d = new Date(p.created_at);
          d.setHours(0, 0, 0, 0);
          return d.getTime();
        })
      );
      const dayMs = 86400000;
      // Check today or yesterday as start
      let checkDate = today.getTime();
      if (!postDays.has(checkDate)) {
        checkDate = today.getTime() - dayMs;
      }
      while (postDays.has(checkDate)) {
        streak++;
        checkDate -= dayMs;
      }
    }

    return NextResponse.json({
      stats: [
        { label: "Connected Repos", value: repos?.length ?? 0 },
        { label: "Draft Posts", value: drafts.length },
        { label: "Published", value: published.length },
        { label: "Streak Days", value: streak },
      ],
      posts: posts ?? [],
      connections: connectionsCount ?? 0,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
