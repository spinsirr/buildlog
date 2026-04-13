-- Flip decision layer to default-on.
-- The agent decision layer (SKIP / BUNDLE_LATER / POST) filters noise and
-- produces higher-quality posts. Previously opt-in (default false); now
-- opt-out (default true). Users who really want raw every-commit-becomes-a-post
-- behaviour can toggle it off.

ALTER TABLE public.profiles
  ALTER COLUMN decision_layer_enabled SET DEFAULT true;

-- Flip any existing rows that are still on the old default.
-- No-op after the DB reset, but keeps the migration idempotent for dev branches.
UPDATE public.profiles
  SET decision_layer_enabled = true
  WHERE decision_layer_enabled = false;
