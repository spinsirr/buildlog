# Weekly Recap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Weekly Recap" button to the posts dashboard that generates a recap draft from the past 7 days of bundle_later decisions + published posts.

**Architecture:** New `generate-recap` Supabase Edge Function (Deno) that queries `post_decisions` and `posts`, builds a recap prompt, calls Gemini, and inserts a draft post with `source_type='recap'`. Frontend adds a button to `posts-client.tsx` that calls the Edge Function via `callEdgeFunction`.

**Tech Stack:** Deno (Edge Function), Gemini API (via `callGemini` from `_shared/ai.ts`), React (button component), Supabase (data queries)

---

### Task 1: Add 'recap' to Post source_type

**Files:**
- Modify: `lib/types.ts:4` (source_type field comment — it's already `string`, no code change needed)

This is a documentation-only task. The `Post` type uses `source_type: string` (not a union), so no TypeScript change is required. But we confirm the posts table accepts any string for source_type.

- [ ] **Step 1: Verify schema allows 'recap' source_type**

Run: `grep -n "source_type" supabase/migrations/*.sql | head -10`

The `posts` table has `source_type text` with no CHECK constraint, so 'recap' is valid.

- [ ] **Step 2: Commit (no-op, move on)**

No file changes needed. Continue to Task 2.

---

### Task 2: Export `callGemini` from `_shared/ai.ts`

**Files:**
- Modify: `supabase/functions/_shared/ai.ts`

The `callGemini` function is currently private. The recap Edge Function needs to call it directly (not through `generatePost`, since recap has its own prompt structure).

- [ ] **Step 1: Export callGemini**

In `supabase/functions/_shared/ai.ts`, change:

```typescript
// Before (around line 192):
async function callGemini(

// After:
export async function callGemini(
```

- [ ] **Step 2: Verify no breakage**

Run: `bun run backend:check`
Expected: PASS (exporting a previously-private function is additive)

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/ai.ts
git commit -m "refactor: export callGemini for reuse by generate-recap"
```

---

### Task 3: Create `generate-recap` Edge Function

**Files:**
- Create: `supabase/functions/generate-recap/index.ts`

- [ ] **Step 1: Create the Edge Function file**

```typescript
import { requireUser } from "../_shared/auth.ts"
import { callGemini } from "../_shared/ai.ts"
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts"
import { getLog, setupLogger } from "../_shared/logger.ts"

await setupLogger()
const log = getLog("generate-recap")

const RECAP_WINDOW_DAYS = 7

Deno.serve(async (req) => {
  const optionsRes = handleOptions(req)
  if (optionsRes) return optionsRes

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, req)
  }

  const { user, supabase, error: authError } = await requireUser(req)
  if (!user) {
    return errorResponse(authError ?? "Unauthorized", 401, req)
  }

  try {
    const since = new Date(Date.now() - RECAP_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

    // 1. Check for existing recap this week (Monday-aligned)
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    monday.setHours(0, 0, 0, 0)

    const { count: existingRecap } = await supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("source_type", "recap")
      .gte("created_at", monday.toISOString())

    if ((existingRecap ?? 0) > 0) {
      return jsonResponse({ ok: false, reason: "recap_exists" }, req)
    }

    // 2. Fetch bundle_later decisions from last 7 days
    const { data: bundles } = await supabase
      .from("post_decisions")
      .select("id, source_type, source_data, reason, angle, confidence, repo_id, created_at")
      .eq("user_id", user.id)
      .eq("decision", "bundle_later")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20)

    // 3. Fetch published + draft posts from last 7 days
    const { data: recentPosts } = await supabase
      .from("posts")
      .select("id, content, source_type, source_data, repo_id, created_at")
      .eq("user_id", user.id)
      .in("status", ["published", "draft"])
      .neq("source_type", "recap")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20)

    const hasBundles = (bundles?.length ?? 0) > 0
    const hasPosts = (recentPosts?.length ?? 0) > 0

    if (!hasBundles && !hasPosts) {
      return jsonResponse({ ok: false, reason: "no_activity" }, req)
    }

    // 4. Get user profile for tone + x_premium
    const { data: profile } = await supabase
      .from("profiles")
      .select("tone, x_premium")
      .eq("id", user.id)
      .single()

    const tone = profile?.tone ?? "casual"
    const charLimit = profile?.x_premium ? 4000 : 280

    // 5. Build prompt
    const systemPrompt = buildRecapSystemPrompt(tone, charLimit)
    const userPrompt = buildRecapUserPrompt(bundles ?? [], recentPosts ?? [])

    // 6. Generate via Gemini
    const { text } = await callGemini(systemPrompt, userPrompt, {
      maxOutputTokens: profile?.x_premium ? 2000 : 800,
      temperature: 0.8,
    })

    let content = text.trim()
    if (content.length < 10) {
      return jsonResponse({ ok: false, reason: "generation_error", error: "Generated content was too short" }, req)
    }

    // Retry if over char limit
    if (content.length > charLimit) {
      const retry = await callGemini(
        systemPrompt,
        `${userPrompt}\n\nIMPORTANT: Your previous attempt was ${content.length} characters. Rewrite under ${charLimit} characters.`,
        { maxOutputTokens: profile?.x_premium ? 2000 : 800, temperature: 0.5 },
      )
      const retryText = retry.text.trim()
      if (retryText.length <= charLimit) {
        content = retryText
      } else {
        // Force-truncate to last sentence
        const match = retryText.slice(0, charLimit).match(/^([\s\S]*[.!?])(\s*#\S+)*/)
        content = match ? match[0].trim() : retryText.slice(0, charLimit - 1) + "\u2026"
      }
    }

    // 7. Insert recap draft
    const sourceData = {
      bundled_decision_ids: (bundles ?? []).map((b: { id: string }) => b.id),
      published_post_ids: (recentPosts ?? []).map((p: { id: string }) => p.id),
      window: "7d",
      generated_at: new Date().toISOString(),
    }

    const { data: post, error: insertError } = await supabase
      .from("posts")
      .insert({
        user_id: user.id,
        source_type: "recap",
        source_data: sourceData,
        content,
        original_content: content,
        status: "draft",
      })
      .select("id, content, source_type, status, created_at")
      .single()

    if (insertError) {
      log.error("failed to insert recap: {error}", { error: insertError.message })
      return jsonResponse({ ok: false, reason: "generation_error", error: insertError.message }, req)
    }

    log.info("generated recap for user {userId}: {postId}", { userId: user.id, postId: post.id })
    return jsonResponse({ ok: true, post }, req)
  } catch (err) {
    log.error("recap generation failed: {error}", { error: String(err) })
    return jsonResponse(
      { ok: false, reason: "generation_error", error: err instanceof Error ? err.message : String(err) },
      req,
    )
  }
})

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

interface BundleDecision {
  id: string
  source_type: string
  source_data: Record<string, unknown>
  reason: string
  angle: string | null
  created_at: string
}

interface RecentPost {
  id: string
  content: string
  source_type: string
  source_data: Record<string, unknown> | null
  created_at: string
}

const toneInstructions: Record<string, string> = {
  casual: "Use a friendly, conversational tone. Sound like a developer tweeting to friends.",
  professional: "Use a polished, professional tone. Sound like a founder giving a confident product update.",
  technical: "Use a technical tone with specifics. Sound like a senior engineer sharing knowledge.",
}

function buildRecapSystemPrompt(tone: string, charLimit: number): string {
  return `You are a weekly recap writer for a developer's "build in public" social media.

TONE:
${toneInstructions[tone] ?? toneInstructions.casual}

YOUR JOB: Read the developer's week of activity below and write a single recap post summarizing what they shipped. Weave bundled (deferred) events into a coherent narrative alongside already-published updates.

CRITICAL RULES:
- MUST be under ${charLimit} characters
- Highlight the overall theme or direction of the week
- Mention 2-4 key things shipped or worked on
- End with 1-2 relevant hashtags
- Sound like a real person, not a bot
- Do NOT expose file names, function names, or internal architecture
- Talk about what the USER can now do or what PROGRESS was made
- If there are bundled events, weave them into the narrative naturally
- This is a WEEKLY SUMMARY, not individual updates

Output ONLY the post text, nothing else.`
}

function buildRecapUserPrompt(bundles: BundleDecision[], posts: RecentPost[]): string {
  const parts: string[] = []

  if (bundles.length > 0) {
    const bundleLines = bundles.map((b) => {
      const msg = (b.source_data?.message ?? b.source_data?.title ?? "unknown change") as string
      return `- [${b.source_type}] ${msg} — reason deferred: "${b.reason}"${b.angle ? ` (angle: ${b.angle})` : ""}`
    })
    parts.push(`BUNDLED EVENTS (deferred from individual posts, not yet shared publicly):\n${bundleLines.join("\n")}`)
  }

  if (posts.length > 0) {
    const postLines = posts.map((p) => `- "${p.content}"`)
    parts.push(`ALREADY SHARED THIS WEEK:\n${postLines.join("\n")}`)
  }

  parts.push("Generate ONE weekly recap post that covers the full week.")
  return parts.join("\n\n")
}
```

- [ ] **Step 2: Verify deno lint + fmt**

```bash
deno lint supabase/functions/generate-recap/index.ts
deno fmt supabase/functions/generate-recap/index.ts
```

Expected: Clean or minor format fixes applied.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/generate-recap/index.ts
git commit -m "feat: add generate-recap Edge Function"
```

---

### Task 4: Add Weekly Recap button to posts dashboard

**Files:**
- Modify: `components/posts-client.tsx`

- [ ] **Step 1: Add recap state and handler**

In `posts-client.tsx`, inside the `PostsClient` component (after the existing state declarations around line 186), add:

```typescript
const [recapLoading, setRecapLoading] = useState(false)

async function handleGenerateRecap() {
  setRecapLoading(true)
  try {
    const res = await callEdgeFunction<{ ok: boolean; reason?: string; post?: Post }>('generate-recap')
    if (!res.ok) {
      toast.error('Failed to generate recap', { description: res.error })
      return
    }
    const data = res.data
    if (!data.ok) {
      if (data.reason === 'no_activity') {
        toast('No activity to recap this week')
      } else if (data.reason === 'recap_exists') {
        toast('You already have a recap for this week. Delete it to regenerate.')
      } else {
        toast.error('Recap generation failed', { description: data.reason })
      }
      return
    }
    toast.success('Weekly recap generated!')
    refreshPosts()
  } catch {
    toast.error('Failed to generate recap')
  } finally {
    setRecapLoading(false)
  }
}
```

- [ ] **Step 2: Add the button to the header**

Find the "New Post" button (around line 316-323). Add the recap button before it:

```tsx
<Button
  size="sm"
  variant="outline"
  onClick={handleGenerateRecap}
  disabled={recapLoading}
  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
>
  {recapLoading ? (
    <Loader2 className="h-3.5 w-3.5 animate-spin" />
  ) : (
    <FileText className="h-3.5 w-3.5" />
  )}
  Weekly Recap
</Button>
```

Note: `FileText` and `Loader2` are already imported from lucide-react at the top of the file.

- [ ] **Step 3: Run typecheck**

```bash
bun run typecheck
```

Expected: PASS

- [ ] **Step 4: Run biome + eslint**

```bash
bunx biome check components/posts-client.tsx
bun run lint 2>&1 | grep "posts-client"
```

Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add components/posts-client.tsx
git commit -m "feat: add Weekly Recap button to posts dashboard"
```

---

### Task 5: Test Edge Function locally

- [ ] **Step 1: Run backend checks**

```bash
bun run backend:check
```

Expected: PASS (deno lint + fmt clean)

- [ ] **Step 2: Run full test suite**

```bash
bun run test
```

Expected: 67/67 tests pass (no existing tests break)

- [ ] **Step 3: Run typecheck**

```bash
bun run typecheck
```

Expected: PASS

- [ ] **Step 4: Commit final state**

```bash
git add -A
git status
```

If there are any remaining unstaged changes (deno.lock updates, format fixes), commit them:

```bash
git add -A && git commit -m "chore: lock files and format fixes for generate-recap"
```

---

### Task 6: Version bump + changelog

**Files:**
- Modify: `VERSION`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Bump VERSION**

```bash
# Current: 0.0.1.0 → 0.0.2.0 (new feature)
echo "0.0.2.0" > VERSION
```

- [ ] **Step 2: Add CHANGELOG entry**

Add a new section at the top of the changelog (after line 4), above the existing `## [0.0.1.0]` entry:

```markdown
## [0.0.2.0] - 2026-04-11

### Added
- Weekly Recap: generate a recap draft from your week's bundled events and published posts
- New "Weekly Recap" button on the posts dashboard
- `generate-recap` Edge Function that aggregates bundle_later decisions + published posts into one recap
- Deduplication: only one recap per week (Monday-aligned)
```

- [ ] **Step 3: Commit**

```bash
git add VERSION CHANGELOG.md
git commit -m "chore: bump version and changelog (v0.0.2.0)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
