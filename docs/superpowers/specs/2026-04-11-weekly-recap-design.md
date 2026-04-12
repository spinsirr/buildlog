# Weekly Recap — Design Spec

**Date:** 2026-04-11
**Status:** Approved
**Trigger:** Manual (dashboard button)
**Scope:** 1 Edge Function, 1 UI button, 1 type change

## Problem

`bundle_later` decisions are stored in `post_decisions` but never surfaced. Users who get frequent `bundle_later` results see zero posts generated. There's no mechanism to aggregate deferred events into a coherent shipping update.

## Solution

A "Weekly Recap" button on the posts dashboard that generates a single recap draft from the past 7 days of activity. The recap combines bundled (deferred) events with already-published posts to create a complete "what we shipped this week" narrative.

## Data Flow

```
User clicks "Weekly Recap"
  → posts-client.tsx calls callEdgeFunction('generate-recap')
  → generate-recap Edge Function:
      1. Query post_decisions (bundle_later, last 7 days)
      2. Query posts (published/draft, last 7 days)
      3. If both empty, fallback to commit data from source_data
      4. If all empty → return { ok: false, reason: 'no_activity' }
      5. Check for existing recap this week → return { ok: false, reason: 'recap_exists' }
      6. Build prompt with bundled events + published posts
      7. Call Gemini to generate recap content
      8. Insert post (source_type='recap', status='draft')
      9. Return { ok: true, post: { id, content } }
  → posts-client.tsx refreshes list, new recap draft appears at top
```

## Edge Function: `generate-recap`

**Path:** `supabase/functions/generate-recap/index.ts`
**Method:** POST
**Auth:** JWT (same as generate-post)
**Request body:** None (7-day window is fixed)

### Data Collection (3 layers, by priority)

1. **Bundle events:** `post_decisions` WHERE `decision='bundle_later'` AND `created_at >= now() - 7 days` AND `user_id = current_user`. Fields: `source_type`, `source_data`, `reason`, `angle`, `confidence`, `repo_id`.

2. **Published posts:** `posts` WHERE `status IN ('published', 'draft')` AND `created_at >= now() - 7 days` AND `user_id = current_user`. Fields: `content`, `source_type`, `source_data`, `repo_id`.

3. **Fallback (if both empty):** Extract commit data from any `posts.source_data` in the last 7 days. If still empty, return `{ ok: false, reason: 'no_activity' }`.

### Deduplication

Before generating, query `posts` WHERE `source_type='recap'` AND `created_at >= start of current week (Monday 00:00)`. If exists, return `{ ok: false, reason: 'recap_exists' }`.

### Content Generation

**System prompt structure:**

```
You are a weekly recap writer for a developer's "build in public" social media.

TONE: {user's tone setting: casual/professional/technical}

YOUR JOB: Read the developer's week of activity below and write a single recap post
summarizing what they shipped. Weave bundled (deferred) events into a coherent
narrative alongside already-published updates.

RULES:
- MUST be under {charLimit} characters
- Highlight the overall theme or direction of the week
- Mention 2-4 key things shipped or worked on
- End with 1-2 hashtags
- Sound like a real person, not a bot
- Do NOT expose file names, function names, or internal details
- Talk about what the USER can now do or what PROGRESS was made
```

**User prompt structure:**

```
BUNDLED EVENTS (deferred from individual posts):
- [{source_type}] {source_data.message or title} — reason: "{reason}"
  (repo: {repo_name}, angle: {angle})
[... for each bundle_later decision]

ALREADY PUBLISHED THIS WEEK:
- "{post.content}"
[... for each published post, max 10]

REPO CONTEXT:
{project_context from connected_repos, if available}

Generate ONE weekly recap post.
```

**Gemini call:**
- Model: `gemini-3-flash-preview` (same as existing generation)
- Temperature: 0.8
- maxOutputTokens: x_premium ? 2000 : 800
- Retry logic: same pattern as `generatePost` (retry if over char limit, force-truncate as last resort)

### Post Creation

```sql
INSERT INTO posts (user_id, repo_id, source_type, source_data, content, original_content, status)
VALUES (
  $user_id,
  NULL,  -- recap spans multiple repos
  'recap',
  {
    bundled_decision_ids: [uuid, uuid, ...],
    published_post_ids: [uuid, uuid, ...],
    window: '7d',
    generated_at: ISO timestamp
  },
  $generated_content,
  $generated_content,
  'draft'
)
```

`repo_id` is NULL because a recap may span multiple repos.

### Response

Success: `{ ok: true, post: { id, content, source_type: 'recap', status: 'draft' } }`
No activity: `{ ok: false, reason: 'no_activity' }`
Already exists: `{ ok: false, reason: 'recap_exists' }`
Generation error: `{ ok: false, reason: 'generation_error', error: string }`

## Frontend Changes

### posts-client.tsx

Add a "Weekly Recap" button next to the existing "New Post" button.

**Button behavior:**
1. Click → set loading state, call `callEdgeFunction('generate-recap')`
2. `ok: true` → `refreshPosts()`, recap appears at top of list
3. `ok: false, reason: 'no_activity'` → toast: "No activity to recap this week"
4. `ok: false, reason: 'recap_exists'` → toast: "You already have a recap for this week. Delete it to regenerate."
5. Error → toast error message

**Button placement:** Next to the "+" (new post) button, with a calendar/summary icon. Only visible when user has at least one connected repo.

### PostCard

No changes needed. A recap is a regular draft post. Users can:
- Edit the content
- Preview across platforms
- Publish to connected platforms
- Delete and regenerate

The `source_type: 'recap'` will display in the post metadata (same as 'commit', 'pr', etc.).

## Type Changes

### lib/types.ts

Add `'recap'` to the Post type's source_type:
```typescript
source_type: 'commit' | 'pr' | 'release' | 'tag' | 'manual' | 'intro' | 'recap'
```

## Char Limit

Uses `getContentLimit('twitter', x_premium)` from `lib/platforms.ts` (already exists). The Edge Function imports this or hardcodes the same logic (280 default, 4000 for x_premium).

Since the Edge Function runs in Deno and `lib/platforms.ts` is Node-side, the Edge Function will inline the limit logic:
```typescript
const charLimit = profile.x_premium ? 4000 : 280
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/generate-recap/index.ts` | Create | New Edge Function |
| `components/posts-client.tsx` | Modify | Add Weekly Recap button |
| `lib/types.ts` | Modify | Add 'recap' to source_type |

## Out of Scope (v1)

- Cron-based auto-generation (future: add Supabase cron or Vercel cron)
- Customizable time window (fixed at 7 days for now)
- Per-repo recaps (recap always spans all repos)
- Recap history/analytics
- Bundle event aggregation dashboard (separate feature)

## Testing

- Unit test: recap prompt construction with various data combinations
- Unit test: deduplication logic (recap_exists check)
- Unit test: empty activity handling (no_activity response)
- Manual test: generate recap with bundle_later events + published posts
- Manual test: generate recap with only published posts (no bundles)
- Manual test: generate recap with no activity (toast feedback)
- Manual test: try generating twice in one week (recap_exists toast)
