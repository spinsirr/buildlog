import { createClient } from "@/lib/supabase/server";
import { publishToTwitter } from "@/lib/twitter";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
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
    const body = await request.json();

    // Only allow updating content and status
    const updates: Record<string, unknown> = {};
    if (body.content !== undefined) updates.content = body.content;
    if (body.status !== undefined) updates.status = body.status;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // If publishing, actually post to Twitter
    if (body.status === "published") {
      // Get the post content (use updated content if provided, otherwise fetch current)
      let content = body.content;
      if (!content) {
        const { data: existing } = await supabase
          .from("posts")
          .select("content")
          .eq("id", id)
          .eq("user_id", user.id)
          .single();
        content = existing?.content;
      }

      if (!content) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }

      try {
        const { tweetId, tweetUrl } = await publishToTwitter(user.id, content);
        updates.published_at = new Date().toISOString();
        updates.platform_post_id = tweetId;
        updates.platform_post_url = tweetUrl;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to publish";
        return NextResponse.json({ error: message }, { status: 502 });
      }
    }

    const { data: post, error } = await supabase
      .from("posts")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ post });
  } catch {
    return NextResponse.json(
      { error: "Failed to update post" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete post" },
      { status: 500 }
    );
  }
}
