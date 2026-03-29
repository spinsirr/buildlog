-- Public changelog support: slug + enabled flag on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS changelog_slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS changelog_enabled boolean DEFAULT false;

-- Default slug to github_username for existing users
UPDATE public.profiles
  SET changelog_slug = github_username
  WHERE github_username IS NOT NULL AND changelog_slug IS NULL;

-- Allow public read access to changelog-enabled profiles (no auth needed)
CREATE POLICY "Public can view changelog profiles"
  ON public.profiles FOR SELECT
  USING (changelog_enabled = true);

-- Allow public read access to posts for changelog-enabled users
CREATE POLICY "Public can view changelog posts"
  ON public.posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = posts.user_id
        AND profiles.changelog_enabled = true
    )
  );

-- Allow public read access to repo names for changelog posts
CREATE POLICY "Public can view changelog repo names"
  ON public.connected_repos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = connected_repos.user_id
        AND profiles.changelog_enabled = true
    )
  );

-- Index for fast slug lookups
CREATE INDEX IF NOT EXISTS idx_profiles_changelog_slug
  ON public.profiles (changelog_slug) WHERE changelog_enabled = true;
