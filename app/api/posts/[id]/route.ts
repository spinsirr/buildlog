import { createClient } from "@/lib/supabase/server";
import { publishToTwitter } from "@/lib/twitter";
import { publishToLinkedIn } from "@/lib/linkedin";
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

    // If publishing, post to connected platforms
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

      // Check which platforms are connected
      const { data: connections } = await supabase
        .from("platform_connections")
        .select("platform")
        .eq("user_id", user.id);

      const connectedPlatforms = new Set(connections?.map((c) => c.platform) ?? []);
      const publishedPlatforms: string[] = [];
      const errors: string[] = [];

      // Publish to Twitter if connected
      if (connectedPlatforms.has("twitter")) {
        try {
          const { tweetId, tweetUrl } = await publishToTwitter(user.id, content);
          updates.platform_post_id = tweetId;
          updates.platform_post_url = tweetUrl;
          publishedPlatforms.push("twitter");
        } catch (err) {
          errors.push(`Twitter: ${err instanceof Error ? err.message : "Failed"}`);
        }
      }

      // Publish to LinkedIn if connected
      if (connectedPlatforms.has("linkedin")) {
        try {
          const { postUrl } = await publishToLinkedIn(user.id, content);
          // If no Twitter URL, use LinkedIn URL as the primary
          if (!updates.platform_post_url) {
            updates.platform_post_url = postUrl;
          }
          publishedPlatforms.push("linkedin");
        } catch (err) {
          errors.push(`LinkedIn: ${err instanceof Error ? err.message : "Failed"}`);
        }
      }

      if (publishedPlatforms.length === 0 && connectedPlatforms.size > 0) {
        return NextResponse.json(
          { error: `Publishing failed: ${errors.join("; ")}` },
          { status: 502 }
        );
      }

      if (publishedPlatforms.length === 0) {
        return NextResponse.json(
          { error: "No platforms connected. Connect Twitter or LinkedIn in Settings." },
          { status: 400 }
        );
      }

      updates.published_at = new Date().toISOString();
      updates.platforms = publishedPlatforms;
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
