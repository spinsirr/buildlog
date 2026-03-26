-- Add github_user_id for webhook-based auto-linking of GitHub App installations
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS github_user_id bigint;
CREATE INDEX IF NOT EXISTS idx_profiles_github_user_id ON profiles(github_user_id);
