-- Default `connected_repos.watched_events` to [pull_request, release, create_tag]
-- so `push` is opt-in. Fixes the "one PR = 3 posts" problem where every branch
-- push plus the PR-merge itself was generating a separate draft.
--
-- Mental model:
--   - PR merged, release published, tag pushed = "shipped something" → post
--   - push to any branch (including WIP feature branches) = not shipped yet → skip
-- Users who want per-push posts (e.g. solo devs pushing straight to main)
-- can tick "push" in the repos UI after we add it to EventPicker.

-- 1. Set the column default for future INSERTs
ALTER TABLE public.connected_repos
  ALTER COLUMN watched_events
  SET DEFAULT ARRAY['pull_request', 'release', 'create_tag']::text[];

-- 2. Backfill existing rows that currently have NULL (= watch-all)
-- Only touches rows where the user never explicitly configured watched_events.
UPDATE public.connected_repos
  SET watched_events = ARRAY['pull_request', 'release', 'create_tag']::text[]
  WHERE watched_events IS NULL;
