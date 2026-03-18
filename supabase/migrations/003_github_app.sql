-- Add GitHub App installation ID to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS github_installation_id bigint;

-- Remove token columns no longer needed
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS github_token;

-- Clean up connected_repos (no per-repo webhook secrets needed with GitHub App)
ALTER TABLE public.connected_repos
  DROP COLUMN IF EXISTS webhook_secret,
  DROP COLUMN IF EXISTS webhook_id;
