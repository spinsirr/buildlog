-- Fix #7: Add a unique index on the dedupe key to prevent TOCTOU race conditions.
-- Two concurrent webhooks for the same event will conflict on insert instead of
-- both passing the SELECT check.
-- We extract the _dedupe_key from the jsonb source_data column and create a
-- partial unique index (only where the key exists).
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_dedupe_key
  ON public.posts (user_id, (source_data->>'_dedupe_key'))
  WHERE source_data->>'_dedupe_key' IS NOT NULL;
