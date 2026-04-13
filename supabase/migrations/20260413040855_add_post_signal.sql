-- AI ranker output attached to each auto-generated post.
-- Replaces the old gatekeeper behaviour (SKIP / BUNDLE_LATER silent-drop)
-- with a ranker that always creates a draft and labels its quality.
--
-- signal = 'high'  → AI thinks this is worth shipping; shown by default
-- signal = 'low'   → AI thinks it's internal/trivial; collapsed in UI
-- signal = null    → manual post / recap / legacy — no ranking applied

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS signal text CHECK (signal IN ('high', 'low')),
  ADD COLUMN IF NOT EXISTS signal_reason text,
  ADD COLUMN IF NOT EXISTS angle text;

-- UI default-sort index: newest high-signal first
CREATE INDEX IF NOT EXISTS idx_posts_signal_status_created
  ON public.posts (user_id, status, signal, created_at DESC);
